import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { checkContrast, checkPalette, checkSafeZone, checkSize } from "../src/checks/technical";
import { closeBrowser, renderHtml, type TextBox } from "../src/render/render";
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
  afterAll(closeBrowser);

  const doc = (bg: string, text: string) =>
    `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0}body{width:800px;height:400px;position:relative;background:${bg}}</style></head><body>${text}</body></html>`;
  const run = async (bg: string, text: string) => {
    const r = await renderHtml(doc(bg, text), 800, 400);
    return checkContrast(r, r.textBoxes, contrast);
  };
  const label = (style: string, content = "Daily Hug Bag") =>
    `<div data-text="t" style="position:absolute;left:40px;top:150px;font-family:sans-serif;font-weight:700;${style}">${content}</div>`;

  it("chữ trắng vắt qua nền nửa trắng nửa tối bị bắt", async () => {
    const halves = `<div style="position:absolute;left:0;top:0;width:400px;height:400px;background:#ffffff"></div>`;
    const issues = await run("#3B3D3F", halves + label("font-size:48px;color:#ffffff;white-space:nowrap", "Daily Hug Bag Hug"));
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/%/);
    expect(issues[0].textId).toBe("t");
  });

  it("chữ trắng hoàn toàn trên nền #3B3D3F đạt", async () => {
    expect(await run("#3B3D3F", label("font-size:48px;color:#ffffff"))).toEqual([]);
  });

  it("chữ trắng mờ (opacity .15) trên nền #3B3D3F bị bắt", async () => {
    expect(await run("#3B3D3F", label("font-size:48px;color:#ffffff;opacity:.15"))).toHaveLength(1);
  });

  it("chữ trắng trên nền trắng bị bắt, chữ đen trên nền trắng đạt", async () => {
    expect(await run("#ffffff", label("font-size:30px;color:#ffffff"))).toHaveLength(1);
    expect(await run("#ffffff", label("font-size:30px;color:#000000"))).toEqual([]);
  });

  it("chữ lớn dùng ngưỡng 3:1", async () => {
    // #8a8a8a on white ≈ 3.45:1 — fails small text, passes large text.
    expect(await run("#ffffff", label("font-size:16px;font-weight:400;color:#8a8a8a"))).toHaveLength(1);
    expect(await run("#ffffff", label("font-size:64px;font-weight:400;color:#8a8a8a"))).toEqual([]);
  });

  it("báo lỗi khi không tìm thấy nét chữ trong khối", async () => {
    expect((await run("#ffffff", label("font-size:30px;color:#000000", "&nbsp;")))[0]?.message).toMatch(/không tìm thấy nét chữ/);
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
