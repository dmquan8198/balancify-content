import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import type { Pillar, Rulebook } from "./types";

export class RulebookError extends Error {}

const HEX = /^#[0-9A-Fa-f]{6}$/;
const FAMILIES = ["F1", "F2", "F3", "F4"];
const GOALS = ["B", "C", "D"];
const PHOTOS = ["flatlay", "lifestyle", "any"];
const FONT_KEYS = ["display", "body", "body_semibold", "handwriting"] as const;

function req(cond: unknown, message: string): asserts cond {
  if (!cond) throw new RulebookError(message);
}

function read<T>(dir: string, name: string): T {
  return parse(readFileSync(join(dir, `${name}.yaml`), "utf8")) as T;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const isPosNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

function strList(v: unknown, field: string): string[] {
  req(Array.isArray(v) && v.every(isStr), `${field} phải là danh sách chuỗi không rỗng`);
  return v as string[];
}

export function validate(rb: Rulebook): void {
  req(isObj(rb.brand) && isStr(rb.brand.name), "brand.name thiếu");
  req(isStr(rb.brand.product), "brand.product thiếu hoặc rỗng");
  req(Array.isArray(rb.brand.product_facts) && rb.brand.product_facts.length > 0, "brand.product_facts phải có ít nhất 1 dòng");

  const voice = rb.voice;
  req(isObj(voice) && isStr(voice.pronoun), "voice.pronoun thiếu");
  const forbidden = strList(voice.forbidden, "voice.forbidden");
  strList(voice.blocked_claims, "voice.blocked_claims");
  req(isObj(voice.english_allowed), "voice.english_allowed thiếu");
  strList(voice.english_allowed.phrases, "voice.english_allowed.phrases");
  strList(voice.english_allowed.words, "voice.english_allowed.words");
  const tags = strList(voice.hashtags_allowed, "voice.hashtags_allowed");
  req(tags.every((t) => t.startsWith("#")), "voice.hashtags_allowed: mỗi hashtag phải bắt đầu bằng #");
  req(isObj(voice.replacements) && Object.values(voice.replacements).every(isStr), "voice.replacements phải là object với giá trị chuỗi không rỗng");
  req(!forbidden.some((w) => w.toLowerCase() === voice.pronoun.toLowerCase()), `voice.pronoun "${voice.pronoun}" không được nằm trong voice.forbidden`);

  const visual = rb.visual;
  req(isObj(visual), "visual thiếu");
  req(isObj(visual.neutrals), "visual.neutrals phải là object");
  req(isObj(visual.colorways) && Object.keys(visual.colorways).length > 0, "visual.colorways trống");
  for (const [name, c] of Object.entries(visual.colorways)) {
    req(isObj(c), `colorway "${name}" phải là object`);
    req(typeof c.accent === "string" && HEX.test(c.accent), `màu colorway "${name}" không phải hex 6 số: ${c.accent}`);
  }
  for (const [name, hex] of Object.entries(visual.neutrals)) {
    req(typeof hex === "string" && HEX.test(hex), `màu nền "${name}" không phải hex 6 số: ${hex}`);
  }
  req(
    isStr(visual.colorway_name_fallback) && Object.hasOwn(visual.neutrals, visual.colorway_name_fallback),
    `visual.colorway_name_fallback phải là một khóa trong neutrals (${Object.keys(visual.neutrals).join(", ")}), đang là ${visual.colorway_name_fallback}`,
  );
  for (const key of FONT_KEYS) req(visual.fonts?.[key]?.file, `visual.fonts.${key} thiếu`);

  req(isObj(visual.formats), "visual.formats thiếu");
  for (const name of ["feed", "story"] as const) {
    const f = visual.formats[name];
    req(isObj(f), `visual.formats.${name} thiếu`);
    req(isInt(f.width) && f.width > 0, `visual.formats.${name}.width phải là số nguyên dương`);
    req(isInt(f.height) && f.height > 0, `visual.formats.${name}.height phải là số nguyên dương`);
    for (const key of ["safe_top", "safe_bottom"] as const) {
      req(f[key] === undefined || (isInt(f[key]) && f[key]! >= 0), `visual.formats.${name}.${key} phải là số nguyên không âm`);
    }
  }

  req(isObj(visual.contrast), "visual.contrast thiếu");
  for (const key of ["min_small", "min_large", "large_px"] as const) {
    req(isPosNum(visual.contrast[key]), `visual.contrast.${key} phải là số dương`);
  }

  req(isObj(rb.pillars), "pillars phải là object");
  for (const [name, p] of Object.entries(rb.pillars)) {
    req(isObj(p), `pillar ${name} phải là object`);
    req(FAMILIES.includes(p.family), `pillar ${name}: family phải là F1–F4, đang là ${p.family}`);
    req(Array.isArray(p.goals) && p.goals.length > 0 && p.goals.every((g) => GOALS.includes(g)), `pillar ${name}: goals phải là danh sách không rỗng gồm B/C/D`);
    req(PHOTOS.includes(p.photo), `pillar ${name}: photo phải là flatlay/lifestyle/any, đang là ${p.photo}`);
  }
}

export function loadRulebook(dir = join(process.cwd(), "rulebook")): Rulebook {
  const pillarsFile = read<{ pillars?: Record<string, Pillar> } | null>(dir, "pillars");
  req(isObj(pillarsFile) && isObj(pillarsFile.pillars), "pillars.yaml phải có khóa pillars");
  const rb: Rulebook = {
    brand: read(dir, "brand"),
    voice: read(dir, "voice"),
    visual: read(dir, "visual"),
    pillars: pillarsFile.pillars,
  };
  validate(rb);
  return rb;
}
