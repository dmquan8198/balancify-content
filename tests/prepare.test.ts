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

  it("xoay ảnh theo EXIF 8 (xoay ngược chiều kim đồng hồ)", async () => {
    // Landscape: left half red, right half blue. EXIF 8 = rotate 90° counter-clockwise, so right becomes top.
    const half = { width: 2000, height: 3000, channels: 3 as const };
    const red = await sharp({ create: { ...half, background: "#ff0000" } }).png().toBuffer();
    const blue = await sharp({ create: { ...half, background: "#0000ff" } }).png().toBuffer();
    const src = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#000000" } })
      .composite([{ input: red, left: 0, top: 0 }, { input: blue, left: 2000, top: 0 }])
      .jpeg()
      .withMetadata({ orientation: 8 })
      .toBuffer();
    const out = await preparePhoto(src, 1080, 1350);
    expect((await pixel(out, 540, 10))[2]).toBeGreaterThan(200);
    expect((await pixel(out, 540, 1340))[0]).toBeGreaterThan(200);
  });

  it("từ chối khi vùng cắt nhỏ hơn khung đích", async () => {
    const landscape = await sharp({ create: { width: 1920, height: 1080, channels: 3, background: "#888888" } }).jpeg().toBuffer();
    await expect(preparePhoto(landscape, 1080, 1920)).rejects.toThrow(PhotoError);
  });

  it("ảnh điện thoại 3024×4032 dùng được cho cả Feed và Story", async () => {
    const phone = await sharp({ create: { width: 3024, height: 4032, channels: 3, background: "#888888" } }).jpeg().toBuffer();
    for (const [w, h] of [[1080, 1350], [1080, 1920]]) {
      const meta = await sharp(await preparePhoto(phone, w, h)).metadata();
      expect([meta.width, meta.height]).toEqual([w, h]);
    }
  });

  it("từ chối điểm lấy nét không phải số hữu hạn", async () => {
    const src = await sharp({ create: { width: 3000, height: 4000, channels: 3, background: "#888888" } }).jpeg().toBuffer();
    await expect(preparePhoto(src, 1080, 1350, { x: Number.NaN, y: 0.5 })).rejects.toThrow(PhotoError);
    await expect(preparePhoto(src, 1080, 1350, { x: 0.5, y: Number.POSITIVE_INFINITY })).rejects.toThrow(PhotoError);
  });

  it("báo PhotoError khi không đọc được ảnh, kèm lỗi gốc", async () => {
    const err = await preparePhoto(Buffer.from("not an image"), 1080, 1350).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PhotoError);
    expect((err as Error).message).toMatch(/Không đọc được ảnh/);
    expect((err as Error).message).toMatch(/unsupported image format/i);
  });

  it("nền trong suốt thành trắng, không thành đen", async () => {
    const src = await sharp({ create: { width: 2000, height: 2500, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const out = await preparePhoto(src, 1080, 1350);
    const [r, g, b] = await pixel(out, 0, 0);
    expect(Math.min(r, g, b)).toBeGreaterThan(245);
  });

  it("báo PhotoError khi không có file ảnh", async () => {
    const err = await preparePhoto("/khong/co/anh.jpg", 1080, 1350).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PhotoError);
    expect((err as Error).message).toBe("Không tìm thấy file ảnh: /khong/co/anh.jpg");
  });
});
