import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runTechnicalChecks, type CheckIssue } from "../checks/technical";
import { hasErrors, lintText, type LintIssue } from "../lint/voice";
import { preparePhoto, type Focus } from "../render/prepare";
import { renderHtml } from "../render/render";
import { loadRulebook } from "../rulebook/load";
import { f1Html, type FormatName } from "../templates/f1";

export interface F1Options {
  photo: string | Buffer;
  colorway: string;
  outDir: string;
  focus?: Focus;
  label?: string;
}

export interface F1FormatReport {
  format: FormatName;
  file: string;
  checks: CheckIssue[];
}

export interface F1Report {
  colorway: string;
  lint: LintIssue[];
  formats: F1FormatReport[];
  ok: boolean;
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function runF1(opts: F1Options): Promise<F1Report> {
  const rb = loadRulebook();
  if (!rb.visual.colorways[opts.colorway]) throw new Error(`Không có colorway "${opts.colorway}" trong rulebook/visual.yaml`);
  const label = opts.label ?? rb.brand.product;
  const lint = lintText(label, rb.voice);
  mkdirSync(opts.outDir, { recursive: true });

  const formats: F1FormatReport[] = [];
  for (const format of ["feed", "story"] as const) {
    const fmt = rb.visual.formats[format];
    const photoJpeg = await preparePhoto(opts.photo, fmt.width, fmt.height, opts.focus);
    const t = f1Html(rb, { photoJpeg, colorway: opts.colorway, format, label });
    const rendered = await renderHtml(t.html, t.width, t.height, t.fonts);
    const checks = await runTechnicalChecks(rendered, fmt, rb.visual);
    const file = join(opts.outDir, `f1-${slug(opts.colorway)}-${format}.png`);
    writeFileSync(file, rendered.png);
    formats.push({ format, file, checks });
  }

  const report: F1Report = { colorway: opts.colorway, lint, formats, ok: !hasErrors(lint) && formats.every((f) => f.checks.length === 0) };
  writeFileSync(join(opts.outDir, "report.json"), JSON.stringify(report, null, 2));
  return report;
}
