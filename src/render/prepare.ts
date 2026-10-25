import { existsSync } from "node:fs";
import sharp, { type Metadata } from "sharp";

export class PhotoError extends Error {}

/** Point to keep in frame when cropping, as fractions of width/height (0–1). */
export interface Focus {
  x: number;
  y: number;
}

export const MIN_SHORT_SIDE = 1080;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Display size of a photo after EXIF auto-rotation (orientations 5–8 swap width and height). */
export async function orientedSize(input: string | Buffer): Promise<{ width: number; height: number }> {
  if (typeof input === "string" && !existsSync(input)) throw new PhotoError(`Không tìm thấy file ảnh: ${input}`);
  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch (e) {
    throw new PhotoError(`Không đọc được ảnh (có thể sai định dạng hoặc thiếu codec, ví dụ HEIC): ${errText(e)}`);
  }
  const swap = (meta.orientation ?? 1) >= 5;
  return { width: (swap ? meta.height : meta.width) ?? 0, height: (swap ? meta.width : meta.height) ?? 0 };
}

/** Largest crop of a w×h photo with the target frame's aspect ratio. */
export function cropSize(w: number, h: number, width: number, height: number): { width: number; height: number } {
  const ratio = width / height;
  return w / h > ratio ? { width: Math.round(h * ratio), height: h } : { width: w, height: Math.round(w / ratio) };
}

/** Whether a w×h photo can fill a width×height frame without upscaling. */
export function fitsFormat(w: number, h: number, width: number, height: number): boolean {
  if (Math.min(w, h) < MIN_SHORT_SIDE) return false;
  const c = cropSize(w, h, width, height);
  return c.width >= width && c.height >= height;
}

export async function preparePhoto(input: string | Buffer, width: number, height: number, focus: Focus = { x: 0.5, y: 0.5 }): Promise<Buffer> {
  if (!Number.isFinite(focus.x) || !Number.isFinite(focus.y)) {
    throw new PhotoError(`Điểm lấy nét không hợp lệ (x=${focus.x}, y=${focus.y}); cần là số từ 0 đến 1.`);
  }

  const { width: w, height: h } = await orientedSize(input);
  if (Math.min(w, h) < MIN_SHORT_SIDE) {
    throw new PhotoError(`Ảnh quá nhỏ (${w}×${h}); cạnh ngắn cần ít nhất ${MIN_SHORT_SIDE}px.`);
  }

  const { width: cw, height: ch } = cropSize(w, h, width, height);
  if (cw < width || ch < height) {
    throw new PhotoError(`Vùng cắt ${cw}×${ch} nhỏ hơn khung đích ${width}×${height}; ảnh sẽ bị phóng to và mờ. Hãy dùng ảnh lớn hơn hoặc đúng chiều.`);
  }
  const left = clamp(Math.round(focus.x * w - cw / 2), 0, w - cw);
  const top = clamp(Math.round(focus.y * h - ch / 2), 0, h - ch);

  try {
    // One pipeline, one JPEG encode: auto-rotate first so extract works in display coordinates.
    return await sharp(input)
      .rotate()
      .extract({ left, top, width: cw, height: ch })
      .resize(width, height)
      .flatten({ background: "#ffffff" })
      .modulate({ brightness: 1.02, saturation: 1.05 })
      .jpeg({ quality: 92 })
      .toBuffer();
  } catch (e) {
    throw new PhotoError(`Không xử lý được ảnh: ${errText(e)}`);
  }
}
