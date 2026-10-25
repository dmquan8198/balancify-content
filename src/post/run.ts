import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PhotoCard } from "../cards/cards";
import { contactSheet } from "../contact/sheet";
import { runF1, type F1Report } from "../pipeline/f1";
import { loadRulebook } from "../rulebook/load";
import { joinMessages, NAME_FALLBACK_NOTE } from "./format";
import { PlanError, validatePlan, type PlanIssue, type PostPlan } from "./plan";

export interface SlideResult {
  index: number;
  why: string;
  report: F1Report;
}

export interface PostResult {
  ok: boolean;
  warnings: PlanIssue[];
  slides: SlideResult[];
  reviewFile: string;
  previewFile: string;
  captionFile: string;
}

const FORMAT_LABEL = { feed: "Feed", story: "Story" } as const;

/** Throws PlanError (before writing anything) when the plan has errors. */
export function checkPlan(plan: PostPlan, cards: PhotoCard[] = []): PlanIssue[] {
  const issues = validatePlan(plan, loadRulebook(), cards);
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) throw new PlanError(`Kế hoạch bài có ${errors.length} lỗi:\n${errors.map((e) => `- ${e.message}`).join("\n")}`);
  return issues;
}

export async function runPost(plan: PostPlan, outDir: string, cards: PhotoCard[] = []): Promise<PostResult> {
  const warnings = checkPlan(plan, cards);

  const slides: SlideResult[] = [];
  for (const [i, s] of plan.slides.entries()) {
    const report = await runF1({ photo: s.photo, colorway: s.colorway, focus: s.focus, outDir: join(outDir, `slide-${i + 1}`) });
    slides.push({ index: i + 1, why: s.why, report });
  }

  mkdirSync(outDir, { recursive: true });
  const captionFile = join(outDir, "caption.txt");
  writeFileSync(captionFile, `${plan.caption}\n\n${plan.hashtags.join(" ")}\n`);

  const previewFile = join(outDir, "preview.jpg");
  await contactSheet(
    slides.flatMap((s) => s.report.formats.map((f) => ({ file: f.file, label: `${s.index} ${FORMAT_LABEL[f.format]}` }))),
    previewFile,
    { cell: 360, cols: 2 },
  );

  const ok = slides.every((s) => s.report.ok);
  const lines = [
    `# Gói duyệt — mục tiêu ${plan.goal} · trụ ${plan.pillar} · ${plan.family}`,
    "",
    ok ? "KẾT QUẢ: ĐẠT" : "KẾT QUẢ: CÓ LỖI",
    "",
    "## Caption",
    "",
    plan.caption,
    "",
    plan.hashtags.join(" "),
    "",
  ];
  for (const s of slides) {
    lines.push(`## Slide ${s.index} — ${s.report.colorway}`, "", `Lý do chọn ảnh: ${s.why}`, "");
    for (const f of s.report.formats) {
      const status = f.checks.length === 0 ? "đạt" : joinMessages(f.checks.map((c) => c.message));
      lines.push(`- ${FORMAT_LABEL[f.format]}: ${f.file} — ${status}${f.nameColor === "fallback" ? NAME_FALLBACK_NOTE : ""}`);
    }
    for (const issue of s.report.lint) lines.push(`- Chữ: ${issue.message}`);
    lines.push("");
  }
  if (warnings.length > 0) lines.push("## Cảnh báo", "", ...warnings.map((w) => `- ${w.message}`), "");

  const reviewFile = join(outDir, "review.md");
  writeFileSync(reviewFile, lines.join("\n"));
  return { ok, warnings, slides, reviewFile, previewFile, captionFile };
}
