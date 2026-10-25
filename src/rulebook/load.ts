import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import type { Pillar, Rulebook } from "./types";

export class RulebookError extends Error {}

const HEX = /^#[0-9A-Fa-f]{6}$/;
const FAMILIES = ["F1", "F2", "F3", "F4"];
const FONT_KEYS = ["display", "body", "body_semibold", "handwriting"] as const;

function req(cond: unknown, message: string): asserts cond {
  if (!cond) throw new RulebookError(message);
}

function read<T>(dir: string, name: string): T {
  return parse(readFileSync(join(dir, `${name}.yaml`), "utf8")) as T;
}

export function validate(rb: Rulebook): void {
  req(rb.brand?.name, "brand.name thiếu");
  req(Array.isArray(rb.brand.product_facts) && rb.brand.product_facts.length > 0, "brand.product_facts phải có ít nhất 1 dòng");
  req(rb.voice?.pronoun, "voice.pronoun thiếu");
  req(Array.isArray(rb.voice.forbidden), "voice.forbidden phải là danh sách");
  req(rb.visual?.colorways && Object.keys(rb.visual.colorways).length > 0, "visual.colorways trống");
  for (const [name, c] of Object.entries(rb.visual.colorways)) {
    req(HEX.test(c.accent), `màu colorway "${name}" không phải hex 6 số: ${c.accent}`);
  }
  for (const [name, hex] of Object.entries(rb.visual.neutrals)) {
    req(HEX.test(hex), `màu nền "${name}" không phải hex 6 số: ${hex}`);
  }
  for (const key of FONT_KEYS) req(rb.visual.fonts?.[key]?.file, `visual.fonts.${key} thiếu`);
  for (const [name, p] of Object.entries(rb.pillars)) {
    req(FAMILIES.includes(p.family), `pillar ${name}: family phải là F1–F4, đang là ${p.family}`);
  }
}

export function loadRulebook(dir = join(process.cwd(), "rulebook")): Rulebook {
  const rb: Rulebook = {
    brand: read(dir, "brand"),
    voice: read(dir, "voice"),
    visual: read(dir, "visual"),
    pillars: read<{ pillars: Record<string, Pillar> }>(dir, "pillars").pillars,
  };
  validate(rb);
  return rb;
}
