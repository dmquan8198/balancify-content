import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runTechnicalChecks, type CheckIssue } from "../checks/technical";
import { hasErrors, lintText, type LintIssue } from "../lint/voice";
import { preparePhoto, type Focus } from "../render/prepare";
import { renderHtml } from "../render/render";
import { findColorway, slug } from "../rulebook/colorway";
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
  /** Whether the colorway name kept the accent or switched to `colorway_name_fallback`. */
  nameColor: "accent" | "fallback";
}

export interface F1Report {
  colorway: string;
  lint: LintIssue[];
  formats: F1FormatReport[];
  ok: boolean;
}

export { slug };

const NAME_ID = "colorway-name";
const NO_NAME_COLOR_WORKS =
  "Cả màu túi và màu trắng đều không đủ tương phản cho tên colorway — cần ảnh khác hoặc đổi điểm lấy nét (--focus-x/--focus-y).";

const nameContrastIssue = (checks: CheckIssue[]) => checks.find((c) => c.check === "contrast" && c.textId === NAME_ID);

export async function runF1(opts: F1Options): Promise<F1Report> {
  const rb = loadRulebook();
  const colorway = findColorway(rb.visual, opts.colorway).name;
  const label = opts.label ?? rb.brand.product;
  const lint = lintText(label, rb.voice);

  // Clear this colorway's previous results first, so a failed run cannot leave stale files behind.
  const pngPath = (format: FormatName) => join(opts.outDir, `f1-${slug(colorway)}-${format}.png`);
  const reportPath = join(opts.outDir, `report-${slug(colorway)}.json`);
  for (const p of [pngPath("feed"), pngPath("story"), reportPath]) rmSync(p, { force: true });

  // Render everything in memory; touch the output folder only once every format succeeded.
  const formats: F1FormatReport[] = [];
  const pngs: Buffer[] = [];
  for (const format of ["feed", "story"] as const) {
    const fmt = rb.visual.formats[format];
    const photoJpeg = await preparePhoto(opts.photo, fmt.width, fmt.height, opts.focus);
    const render = async (nameColor?: string) => {
      const t = f1Html(rb, { photoJpeg, colorway, format, label, nameColor });
      const r = await renderHtml(t.html, t.width, t.height, t.fonts);
      return { rendered: r, checks: await runTechnicalChecks(r, fmt, rb.visual) };
    };
    let { rendered, checks } = await render();
    let nameColor: F1FormatReport["nameColor"] = "accent";
    const accentIssue = nameContrastIssue(checks);
    if (accentIssue) {
      const fallback = await render(rb.visual.neutrals[rb.visual.colorway_name_fallback]);
      const fallbackIssue = nameContrastIssue(fallback.checks);
      // Keep the fallback only when it is actually better than the accent.
      if (!fallbackIssue || (fallbackIssue.lowShare ?? 1) < (accentIssue.lowShare ?? 1)) {
        ({ rendered, checks } = fallback);
        nameColor = "fallback";
      }
      if (fallbackIssue) checks = [...checks, { check: "contrast", textId: NAME_ID, message: NO_NAME_COLOR_WORKS }];
    }
    pngs.push(rendered.png);
    formats.push({ format, file: pngPath(format), checks, nameColor });
  }

  const report: F1Report = { colorway, lint, formats, ok: !hasErrors(lint) && formats.every((f) => f.checks.length === 0) };
  mkdirSync(opts.outDir, { recursive: true });
  formats.forEach((f, i) => writeFileSync(f.file, pngs[i]));
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return report;
}
