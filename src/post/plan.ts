import { statSync } from "node:fs";
import { resolve } from "node:path";
import { inUnit, type PhotoCard } from "../cards/cards";
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

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isFile = (path: string) => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

/** The card for `photo`, skipping malformed cards (cards.json is user-edited JSON). */
export function findCard(cards: PhotoCard[], photo: string): PhotoCard | undefined {
  const target = resolve(photo);
  return cards.find((c) => typeof c?.file === "string" && resolve(c.file) === target);
}

/** Shape check for a plan read from JSON; returns one message per problem. */
function shapeProblems(plan: unknown): string[] {
  if (!isObject(plan)) return ["Kế hoạch phải là một đối tượng JSON."];
  const problems: string[] = [];
  for (const key of ["goal", "pillar", "family", "caption"]) {
    if (typeof plan[key] !== "string") problems.push(`Trường "${key}" phải là chuỗi.`);
  }
  if (!Array.isArray(plan.slides)) problems.push(`Trường "slides" phải là danh sách.`);
  else {
    plan.slides.forEach((s, i) => {
      const n = i + 1;
      if (!isObject(s)) return problems.push(`Slide ${n} phải là một đối tượng.`);
      if (typeof s.photo !== "string") problems.push(`Slide ${n}: "photo" phải là chuỗi.`);
      if (typeof s.colorway !== "string") problems.push(`Slide ${n}: "colorway" phải là chuỗi.`);
      if (s.why !== undefined && typeof s.why !== "string") problems.push(`Slide ${n}: "why" phải là chuỗi.`);
    });
  }
  if (!Array.isArray(plan.hashtags) || plan.hashtags.some((h) => typeof h !== "string")) {
    problems.push(`Trường "hashtags" phải là danh sách chuỗi.`);
  }
  return problems;
}

export function validatePlan(plan: PostPlan, rb: Rulebook, cards: PhotoCard[] = []): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const error = (message: string) => issues.push({ severity: "error", message });
  const warn = (message: string) => issues.push({ severity: "warn", message });

  const shape = shapeProblems(plan);
  if (shape.length > 0) {
    shape.forEach(error);
    return issues;
  }

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
  const seenPhotos = new Set<string>();
  plan.slides.forEach((s, i) => {
    const n = i + 1;
    if (!isFile(s.photo)) error(`Slide ${n}: Không tìm thấy ảnh ${s.photo}.`);
    if (seenPhotos.has(resolve(s.photo))) warn(`Slide ${n}: dùng cùng ảnh với một slide trước.`);
    seenPhotos.add(resolve(s.photo));
    if (s.focus !== undefined && (!isObject(s.focus) || !inUnit(s.focus.x) || !inUnit(s.focus.y))) {
      error(`Slide ${n}: focus.x và focus.y phải là số từ 0 đến 1.`);
    }
    let slideColorway: string | undefined;
    try {
      slideColorway = findColorway(rb.visual, s.colorway).name;
      if (seen.has(slideColorway)) warn(`Slide ${n}: colorway "${slideColorway}" đã có ở slide trước.`);
      seen.add(slideColorway);
    } catch (e) {
      error(`Slide ${n}: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!s.why?.trim()) warn(`Slide ${n}: thiếu lý do chọn ảnh.`);

    const card = findCard(cards, s.photo);
    if (!card && cards.length > 0) error(`Slide ${n}: ảnh không có thẻ trong cards.json (${s.photo})`);
    if (card) {
      if (card.colorway === null) error(`Slide ${n}: thẻ ảnh chưa xác định colorway — hỏi người dùng.`);
      else if (slideColorway !== undefined) {
        try {
          const cardName = findColorway(rb.visual, card.colorway).name;
          if (cardName !== slideColorway) error(`Slide ${n}: thẻ ảnh ghi colorway "${cardName}" nhưng slide dùng "${slideColorway}".`);
        } catch (e) {
          error(`Slide ${n}: thẻ ảnh: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      if (!card.fits) error(`Slide ${n}: thẻ ảnh chưa được kiểm tra — chạy npm run cards`);
      if (card.quality !== "ok") error(`Slide ${n}: thẻ ảnh ghi chất lượng "${card.quality}".`);
      if (pillar?.photo === "flatlay" && card.kind !== "flatlay") error(`Slide ${n}: trụ ${plan.pillar} cần ảnh flatlay, ảnh này là ${card.kind}.`);
      if (card.fits && !card.fits.feed) error(`Slide ${n}: ảnh không đủ lớn cho Feed.`);
      if (card.fits && !card.fits.story) error(`Slide ${n}: ảnh không đủ lớn cho Story.`);
    }
  });

  if (!plan.caption?.trim()) error("Caption trống.");
  for (const tag of plan.hashtags) {
    if (!tag.startsWith("#")) error(`Hashtag "${tag}" phải bắt đầu bằng #.`);
    else if (!/^#[\p{L}\p{N}_]+$/u.test(tag)) error(`Hashtag "${tag}" chỉ được gồm chữ, số và gạch dưới sau dấu #.`);
  }
  for (const issue of lintText(`${plan.caption}\n${plan.hashtags.join(" ")}`, rb.voice)) {
    (issue.severity === "error" ? error : warn)(`Caption: ${issue.message}`);
  }
  return issues;
}
