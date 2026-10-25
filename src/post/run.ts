import { randomBytes } from "node:crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { PhotoCard } from "../cards/cards";
import { contactSheet } from "../contact/sheet";
import { runF1, type F1Report } from "../pipeline/f1";
import { fitsFormat, orientedSize } from "../render/prepare";
import { loadRulebook } from "../rulebook/load";
import { joinMessages, NAME_FALLBACK_NOTE } from "./format";
import { assertSafeOutDir, POST_PACK_MARKER, POST_PACK_NOTE } from "./outdir";
import { findCard, PlanError, validatePlan, type PlanIssue, type PostPlan } from "./plan";

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

/**
 * Throws PlanError (before writing anything) when the plan has errors, including photos too small
 * for Feed or Story — measured here, so it does not depend on a cards file.
 */
export async function checkPlan(plan: PostPlan, cards: PhotoCard[] = []): Promise<PlanIssue[]> {
  const rb = loadRulebook();
  const issues = validatePlan(plan, rb, cards);
  const shapeOk = Array.isArray(plan?.slides) && plan.slides.every((s) => typeof s?.photo === "string");
  if (shapeOk) {
    const { feed, story } = rb.visual.formats;
    for (const [i, s] of plan.slides.entries()) {
      let size: { width: number; height: number };
      try {
        size = await orientedSize(s.photo);
      } catch {
        continue; // missing or unreadable photos are already reported by validatePlan or fail clearly at render
      }
      for (const [name, f] of [["Feed", feed], ["Story", story]] as const) {
        if (!fitsFormat(size.width, size.height, f.width, f.height)) {
          issues.push({ severity: "error", message: `Slide ${i + 1}: ảnh ${size.width}×${size.height} không đủ lớn cho ${name}.` });
        }
      }
    }
  }
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length > 0) throw new PlanError(`Kế hoạch bài có ${errors.length} lỗi:\n${errors.map((e) => `- ${e.message}`).join("\n")}`);
  return issues;
}

/**
 * Renders into a temporary sibling folder and swaps it in for `outDir` only when every slide
 * succeeded, so a failed run leaves the previous results untouched and no stale slides remain.
 * Only replaces a folder that is missing, empty or a previous pack (see assertSafeOutDir).
 */
export async function runPost(plan: PostPlan, outDir: string, cards: PhotoCard[] = []): Promise<PostResult> {
  const warnings = await checkPlan(plan, cards);
  assertSafeOutDir(outDir, process.cwd());
  const finalDir = resolve(outDir);
  for (const [i, s] of plan.slides.entries()) {
    const rel = relative(finalDir, resolve(s.photo));
    if (rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`))) {
      throw new PlanError(`Slide ${i + 1}: ảnh nằm trong thư mục --out (${s.photo}) — sẽ bị xoá khi thay gói duyệt; hãy để ảnh ở thư mục khác.`);
    }
  }
  const tmpDir = `${finalDir}.tmp-${randomBytes(4).toString("hex")}`;
  mkdirSync(tmpDir, { recursive: true });
  try {
    const result = await build(plan, warnings, tmpDir, cards);
    writeFileSync(join(tmpDir, POST_PACK_MARKER), POST_PACK_NOTE);
    assertSafeOutDir(outDir, process.cwd()); // again: something may have been put there while rendering
    rmSync(finalDir, { recursive: true, force: true });
    renameSync(tmpDir, finalDir);
    const remap = (p: string) => join(finalDir, relative(tmpDir, p));
    for (const s of result.slides) for (const f of s.report.formats) f.file = remap(f.file);
    return { ...result, reviewFile: remap(result.reviewFile), previewFile: remap(result.previewFile), captionFile: remap(result.captionFile) };
  } catch (e) {
    rmSync(tmpDir, { recursive: true, force: true });
    throw e;
  }
}

async function build(plan: PostPlan, warnings: PlanIssue[], outDir: string, cards: PhotoCard[]): Promise<PostResult> {
  const slides: SlideResult[] = [];
  for (const [i, s] of plan.slides.entries()) {
    const card = findCard(cards, s.photo);
    const report = await runF1({ photo: s.photo, colorway: s.colorway, focus: s.focus ?? card?.focus, outDir: join(outDir, `slide-${i + 1}`) });
    slides.push({ index: i + 1, why: s.why, report });
  }

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
    !ok ? "KẾT QUẢ: CÓ LỖI" : warnings.length > 0 ? `KẾT QUẢ: ĐẠT (${warnings.length} cảnh báo — xem mục Cảnh báo)` : "KẾT QUẢ: ĐẠT",
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
      lines.push(`- ${FORMAT_LABEL[f.format]}: ${relative(outDir, f.file)} — ${status}${f.nameColor === "fallback" ? NAME_FALLBACK_NOTE : ""}`);
    }
    for (const issue of s.report.lint) lines.push(`- Chữ: ${issue.message}`);
    lines.push("");
  }
  if (warnings.length > 0) lines.push("## Cảnh báo", "", ...warnings.map((w) => `- ${w.message}`), "");

  const reviewFile = join(outDir, "review.md");
  writeFileSync(reviewFile, lines.join("\n"));
  return { ok, warnings, slides, reviewFile, previewFile, captionFile };
}
