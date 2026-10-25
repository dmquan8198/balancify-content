import sharp from "sharp";
import type { Format, Visual } from "../rulebook/types";
import type { RenderResult, TextBox } from "../render/render";
import { contrastRatio, hexToRgb, parseCssColor, type Rgb } from "./contrast";

export interface CheckIssue {
  check: "size" | "safe_zone" | "contrast" | "palette";
  message: string;
}

const TOLERANCE = 0.5;

export async function checkSize(png: Buffer, fmt: Format): Promise<CheckIssue[]> {
  const { width, height } = await sharp(png).metadata();
  return width === fmt.width && height === fmt.height
    ? []
    : [{ check: "size", message: `Kích thước ${width}×${height}, cần ${fmt.width}×${fmt.height}.` }];
}

export function checkSafeZone(boxes: TextBox[], fmt: Format): CheckIssue[] {
  const top = fmt.safe_top ?? 0;
  const bottom = fmt.height - (fmt.safe_bottom ?? 0);
  const issues: CheckIssue[] = [];
  for (const b of boxes) {
    if (b.y < top - TOLERANCE || b.y + b.height > bottom + TOLERANCE) {
      issues.push({ check: "safe_zone", message: `Chữ "${b.id}" nằm ngoài vùng an toàn dọc (${top}–${bottom}px).` });
    }
    if (b.x < -TOLERANCE || b.x + b.width > fmt.width + TOLERANCE) {
      issues.push({ check: "safe_zone", message: `Chữ "${b.id}" tràn ra ngoài khung ngang.` });
    }
  }
  return issues;
}

export async function checkContrast(background: Buffer, boxes: TextBox[], rules: Visual["contrast"]): Promise<CheckIssue[]> {
  const { width: W = 0, height: H = 0 } = await sharp(background).metadata();
  const issues: CheckIssue[] = [];
  for (const b of boxes) {
    const left = Math.max(0, Math.floor(b.x));
    const top = Math.max(0, Math.floor(b.y));
    const width = Math.min(W - left, Math.ceil(b.width));
    const height = Math.min(H - top, Math.ceil(b.height));
    if (width < 1 || height < 1) continue;
    const { channels } = await sharp(background).extract({ left, top, width, height }).stats();
    const behind: Rgb = [channels[0].mean, channels[1].mean, channels[2].mean];
    const ratio = contrastRatio(parseCssColor(b.color), behind);
    const min = b.fontSizePx >= rules.large_px ? rules.min_large : rules.min_small;
    if (ratio < min) {
      issues.push({ check: "contrast", message: `Chữ "${b.id}" tương phản ${ratio.toFixed(2)}:1, cần ít nhất ${min}:1.` });
    }
  }
  return issues;
}

export function checkPalette(boxes: TextBox[], visual: Visual): CheckIssue[] {
  const allowed = new Set(
    [...Object.values(visual.neutrals), ...Object.values(visual.colorways).map((c) => c.accent)].map((hex) => hexToRgb(hex).join(",")),
  );
  return boxes
    .filter((b) => !allowed.has(parseCssColor(b.color).join(",")))
    .map((b) => ({ check: "palette" as const, message: `Chữ "${b.id}" dùng màu ${b.color}, không có trong bảng màu.` }));
}

export async function runTechnicalChecks(r: RenderResult, fmt: Format, visual: Visual): Promise<CheckIssue[]> {
  return [
    ...(await checkSize(r.png, fmt)),
    ...checkSafeZone(r.textBoxes, fmt),
    ...checkPalette(r.textBoxes, visual),
    ...(await checkContrast(r.background, r.textBoxes, visual.contrast)),
  ];
}
