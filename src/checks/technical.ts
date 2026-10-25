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

/** Share of glyph pixels allowed below the contrast threshold (covers anti-aliased edges). */
export const MAX_LOW_CONTRAST_SHARE = 0.05;

interface RawImage {
  data: Buffer;
  width: number;
  height: number;
  channels: number;
}

async function decode(buf: Buffer): Promise<RawImage> {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

const luma = (img: RawImage, i: number) => 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];

/**
 * For each text box, finds glyph pixels in the mask and compares the rendered pixel against the
 * background pixel at the same spot. Fails when more than MAX_LOW_CONTRAST_SHARE of them are too low.
 */
export async function checkContrast(r: RenderResult, boxes: TextBox[], rules: Visual["contrast"]): Promise<CheckIssue[]> {
  const [png, bg, mask] = await Promise.all([decode(r.png), decode(r.background), decode(r.glyphMask)]);
  const W = mask.width;
  const H = mask.height;
  const issues: CheckIssue[] = [];
  for (const b of boxes) {
    const x0 = Math.max(0, Math.floor(b.x));
    const y0 = Math.max(0, Math.floor(b.y));
    const x1 = Math.min(W, Math.ceil(b.x + b.width));
    const y1 = Math.min(H, Math.ceil(b.y + b.height));
    const min = b.fontSizePx >= rules.large_px ? rules.min_large : rules.min_small;
    let glyphs = 0;
    let low = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * W + x) * mask.channels;
        if (luma(mask, i) >= 128) continue;
        glyphs++;
        const pi = (y * png.width + x) * png.channels;
        const bi = (y * bg.width + x) * bg.channels;
        const fg: Rgb = [png.data[pi], png.data[pi + 1], png.data[pi + 2]];
        const behind: Rgb = [bg.data[bi], bg.data[bi + 1], bg.data[bi + 2]];
        if (contrastRatio(fg, behind) < min) low++;
      }
    }
    if (glyphs === 0) {
      issues.push({ check: "contrast", message: `Chữ "${b.id}": không tìm thấy nét chữ để kiểm tra tương phản.` });
      continue;
    }
    const share = low / glyphs;
    if (share > MAX_LOW_CONTRAST_SHARE) {
      issues.push({
        check: "contrast",
        message: `Chữ "${b.id}" có ${(share * 100).toFixed(1)}% nét chữ tương phản dưới ${min}:1 (cho phép tối đa ${MAX_LOW_CONTRAST_SHARE * 100}%).`,
      });
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
    ...(await checkContrast(r, r.textBoxes, visual.contrast)),
  ];
}
