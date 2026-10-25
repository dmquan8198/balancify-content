import sharp from "sharp";

export class PhotoError extends Error {}

/** Point to keep in frame when cropping, as fractions of width/height (0–1). */
export interface Focus {
  x: number;
  y: number;
}

const MIN_SHORT_SIDE = 1080;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export async function preparePhoto(input: string | Buffer, width: number, height: number, focus: Focus = { x: 0.5, y: 0.5 }): Promise<Buffer> {
  const oriented = await sharp(input).rotate().toBuffer();
  const { width: w = 0, height: h = 0 } = await sharp(oriented).metadata();
  if (Math.min(w, h) < MIN_SHORT_SIDE) {
    throw new PhotoError(`Ảnh quá nhỏ (${w}×${h}); cạnh ngắn cần ít nhất ${MIN_SHORT_SIDE}px.`);
  }

  const ratio = width / height;
  const cw = w / h > ratio ? Math.round(h * ratio) : w;
  const ch = w / h > ratio ? h : Math.round(w / ratio);
  const left = clamp(Math.round(focus.x * w - cw / 2), 0, w - cw);
  const top = clamp(Math.round(focus.y * h - ch / 2), 0, h - ch);

  return sharp(oriented)
    .extract({ left, top, width: cw, height: ch })
    .resize(width, height)
    .modulate({ brightness: 1.02, saturation: 1.05 })
    .jpeg({ quality: 92 })
    .toBuffer();
}
