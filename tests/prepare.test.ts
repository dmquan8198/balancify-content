import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { PhotoError, preparePhoto } from "../src/render/prepare";

async function pixel(buf: Buffer, x: number, y: number): Promise<number[]> {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i], data[i + 1], data[i + 2]];
}

describe("preparePhoto", () => {
  it("cắt về đúng kích thước đích", async () => {
    const src = await sharp({ create: { width: 3000, height: 4000, channels: 3, background: "#888888" } }).jpeg().toBuffer();
    const out = await preparePhoto(src, 1080, 1350);
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height]).toEqual([1080, 1350]);
  });

  it("xoay ảnh theo EXIF trước khi cắt", async () => {
    // Landscape: left half red, right half blue. EXIF 6 = rotate 90° clockwise, so left becomes top.
    const half = { width: 2000, height: 3000, channels: 3 as const };
    const red = await sharp({ create: { ...half, background: "#ff0000" } }).png().toBuffer();
    const blue = await sharp({ create: { ...half, background: "#0000ff" } }).png().toBuffer();
    const src = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#000000" } })
      .composite([{ input: red, left: 0, top: 0 }, { input: blue, left: 2000, top: 0 }])
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const out = await preparePhoto(src, 1080, 1350);
    const top = await pixel(out, 540, 10);
    const bottom = await pixel(out, 540, 1340);
    expect(top[0]).toBeGreaterThan(200);
    expect(bottom[2]).toBeGreaterThan(200);
  });

  it("từ chối ảnh có cạnh ngắn dưới 1080px", async () => {
    const small = await sharp({ create: { width: 800, height: 1000, channels: 3, background: "#888888" } }).jpeg().toBuffer();
    await expect(preparePhoto(small, 1080, 1350)).rejects.toThrow(PhotoError);
  });
});
