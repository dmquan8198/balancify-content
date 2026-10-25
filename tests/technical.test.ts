import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { checkContrast, checkPalette, checkSafeZone, checkSize } from "../src/checks/technical";
import type { TextBox } from "../src/render/render";
import { loadRulebook } from "../src/rulebook/load";

const story = { width: 1080, height: 1920, safe_top: 250, safe_bottom: 340 };
const contrast = { min_small: 4.5, min_large: 3.0, large_px: 24 };
const box = (over: Partial<TextBox>): TextBox => ({ id: "t", x: 100, y: 600, width: 300, height: 60, color: "rgb(255, 255, 255)", fontSizePx: 30, text: "x", ...over });
const solid = (w: number, h: number, bg: string) => sharp({ create: { width: w, height: h, channels: 3, background: bg } }).png().toBuffer();

describe("checkSize", () => {
  it("bắt sai kích thước", async () => {
    expect(await checkSize(await solid(1080, 1920, "#000"), story)).toEqual([]);
    expect(await checkSize(await solid(1080, 1350, "#000"), story)).toHaveLength(1);
  });
});

describe("checkSafeZone", () => {
  it("chữ trong vùng an toàn thì đạt", () => {
    expect(checkSafeZone([box({ y: 600 })], story)).toEqual([]);
  });

  it("bắt chữ lấn vùng trên và vùng dưới của Story", () => {
    expect(checkSafeZone([box({ y: 200 })], story)).toHaveLength(1);
    expect(checkSafeZone([box({ y: 1560, height: 60 })], story)).toHaveLength(1);
  });

  it("bắt chữ tràn ra ngoài khung ngang", () => {
    expect(checkSafeZone([box({ x: 900, width: 300 })], story)).toHaveLength(1);
  });
});

describe("checkContrast", () => {
  it("chữ trắng trên nền trắng bị bắt, chữ đen trên nền trắng đạt", async () => {
    const bg = await solid(1080, 1920, "#ffffff");
    expect(await checkContrast(bg, [box({ color: "rgb(255, 255, 255)" })], contrast)).toHaveLength(1);
    expect(await checkContrast(bg, [box({ color: "rgb(0, 0, 0)" })], contrast)).toEqual([]);
  });

  it("chữ lớn dùng ngưỡng 3:1", async () => {
    const bg = await solid(1080, 1920, "#ffffff");
    // #8a8a8a on white ≈ 3.45:1 — fails small text, passes large text.
    expect(await checkContrast(bg, [box({ color: "rgb(138, 138, 138)", fontSizePx: 16 })], contrast)).toHaveLength(1);
    expect(await checkContrast(bg, [box({ color: "rgb(138, 138, 138)", fontSizePx: 64 })], contrast)).toEqual([]);
  });
});

describe("checkPalette", () => {
  const { visual } = loadRulebook();

  it("màu trắng và màu colorway đạt", () => {
    expect(checkPalette([box({ color: "rgb(255, 255, 255)" }), box({ color: "rgb(178, 207, 234)" })], visual)).toEqual([]);
  });

  it("màu ngoài bảng màu bị bắt", () => {
    expect(checkPalette([box({ color: "rgb(255, 0, 0)" })], visual)).toHaveLength(1);
  });
});
