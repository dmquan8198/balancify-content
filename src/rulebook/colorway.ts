import type { Colorway, Visual } from "./types";

export class ColorwayError extends Error {}

/** ASCII, dash-separated form of a name: "Đi làm vui" → "di-lam-vui". */
export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Finds a colorway by name, ignoring case, spacing and dashes. Returns the rulebook's own name. */
export function findColorway(visual: Visual, input: string): { name: string; colorway: Colorway } {
  const key = slug(input);
  const name = Object.keys(visual.colorways).find((n) => slug(n) === key);
  if (!name) {
    throw new ColorwayError(`Không có colorway "${input}" trong rulebook/visual.yaml. Các colorway hợp lệ: ${Object.keys(visual.colorways).join(", ")}.`);
  }
  return { name, colorway: visual.colorways[name] };
}
