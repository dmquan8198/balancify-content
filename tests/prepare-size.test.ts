import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { cropSize, fitsFormat, MIN_SHORT_SIDE, orientedSize, PhotoError } from "../src/render/prepare";

describe("cropSize / fitsFormat", () => {
  it("ảnh điện thoại dọc 3024×4032", () => {
    expect(cropSize(3024, 4032, 1080, 1350)).toEqual({ width: 3024, height: 3780 });
    expect(cropSize(3024, 4032, 1080, 1920)).toEqual({ width: 2268, height: 4032 });
    expect(fitsFormat(3024, 4032, 1080, 1350)).toBe(true);
    expect(fitsFormat(3024, 4032, 1080, 1920)).toBe(true);
  });

  it("ảnh ngang 1920×1080 không đủ cho Story", () => {
    expect(fitsFormat(1920, 1080, 1080, 1920)).toBe(false);
  });

  it("cạnh ngắn dưới mức tối thiểu thì không đạt", () => {
    expect(MIN_SHORT_SIDE).toBe(1080);
    expect(fitsFormat(1000, 4000, 1080, 1350)).toBe(false);
  });
});

describe("orientedSize", () => {
  it("đổi chiều theo EXIF 6", async () => {
    const buf = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#888" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    expect(await orientedSize(buf)).toEqual({ width: 3000, height: 4000 });
  });

  it("file không tồn tại hoặc không phải ảnh → PhotoError", async () => {
    await expect(orientedSize("/khong/co.jpg")).rejects.toThrow(PhotoError);
    await expect(orientedSize(Buffer.from("not an image"))).rejects.toThrow(PhotoError);
  });
});
