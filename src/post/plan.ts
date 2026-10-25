import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { PhotoCard } from "../cards/cards";
import { lintText } from "../lint/voice";
import type { Focus } from "../render/prepare";
import { findColorway } from "../rulebook/colorway";
import type { Goal, Pillar, Rulebook } from "../rulebook/types";

export class PlanError extends Error {}

export interface PlanSlide {
  photo: string;
  colorway: string;
  focus?: Focus;
  /** Why this photo was chosen — shown to the user in the review pack. */
  why: string;
}

export interface PostPlan {
  goal: Goal;
  pillar: string;
  family: Pillar["family"];
  slides: PlanSlide[];
  caption: string;
  hashtags: string[];
}

export interface PlanIssue {
  severity: "error" | "warn";
  message: string;
}

/** Template families that exist in code. */
export const BUILT_FAMILIES: Pillar["family"][] = ["F1"];
const F1_MAX_SLIDES = 4;

export function validatePlan(plan: PostPlan, rb: Rulebook, cards: PhotoCard[] = []): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const error = (message: string) => issues.push({ severity: "error", message });
  const warn = (message: string) => issues.push({ severity: "warn", message });

  const pillar = rb.pillars[plan.pillar];
  if (!pillar) {
    error(`Trụ "${plan.pillar}" không có trong rulebook/pillars.yaml (có: ${Object.keys(rb.pillars).join(", ")}).`);
  } else {
    if (!pillar.goals.includes(plan.goal)) {
      error(`Mục tiêu ${plan.goal} không thuộc trụ ${plan.pillar} (trụ này phục vụ: ${pillar.goals.join(", ")}).`);
    }
    if (pillar.family !== plan.family) error(`Trụ ${plan.pillar} dùng họ template ${pillar.family}, kế hoạch lại ghi ${plan.family}.`);
  }
  if (!BUILT_FAMILIES.includes(plan.family)) error(`Họ template ${plan.family} chưa được xây (hiện có: ${BUILT_FAMILIES.join(", ")}).`);

  if (plan.family === "F1" && (plan.slides.length < 1 || plan.slides.length > F1_MAX_SLIDES)) {
    error(`F1 cần 1–${F1_MAX_SLIDES} slide, kế hoạch có ${plan.slides.length}.`);
  }

  const seen = new Set<string>();
  plan.slides.forEach((s, i) => {
    const n = i + 1;
    if (!existsSync(s.photo)) error(`Slide ${n}: Không tìm thấy ảnh ${s.photo}.`);
    try {
      const name = findColorway(rb.visual, s.colorway).name;
      if (seen.has(name)) warn(`Slide ${n}: colorway "${name}" đã có ở slide trước.`);
      seen.add(name);
    } catch (e) {
      error(`Slide ${n}: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!s.why?.trim()) warn(`Slide ${n}: thiếu lý do chọn ảnh.`);

    const card = cards.find((c) => resolve(c.file) === resolve(s.photo));
    if (card) {
      if (card.quality !== "ok") error(`Slide ${n}: thẻ ảnh ghi chất lượng "${card.quality}".`);
      if (pillar?.photo === "flatlay" && card.kind !== "flatlay") error(`Slide ${n}: trụ ${plan.pillar} cần ảnh flatlay, ảnh này là ${card.kind}.`);
      if (card.fits && !card.fits.feed) error(`Slide ${n}: ảnh không đủ lớn cho Feed.`);
      if (card.fits && !card.fits.story) error(`Slide ${n}: ảnh không đủ lớn cho Story.`);
    }
  });

  if (!plan.caption?.trim()) error("Caption trống.");
  for (const tag of plan.hashtags) if (!tag.startsWith("#")) error(`Hashtag "${tag}" phải bắt đầu bằng #.`);
  for (const issue of lintText(`${plan.caption}\n${plan.hashtags.join(" ")}`, rb.voice)) {
    (issue.severity === "error" ? error : warn)(`Caption: ${issue.message}`);
  }
  return issues;
}
