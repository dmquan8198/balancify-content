import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { closeBrowser, renderHtml } from "../src/render/render";
import { loadRulebook } from "../src/rulebook/load";
import { f1Html } from "../src/templates/f1";

const rb = loadRulebook();
const photoJpeg = Buffer.from("fake");

describe("f1Html", () => {
  it("dùng màu colorway cho tên và đúng kích thước Story", () => {
    const t = f1Html(rb, { photoJpeg, colorway: "off duty pink", format: "story" });
    expect([t.width, t.height]).toEqual([1080, 1920]);
    expect(t.html).toContain("color:#EDCBC9");
    expect(t.html).toContain(">off duty pink<");
    expect(t.html).toContain(">Daily Hug Bag<");
    expect(t.fonts).toEqual(["Patrick Hand", "Be Vietnam Pro"]);
  });

  it("nameColor thay màu tên colorway", () => {
    const t = f1Html(rb, { photoJpeg, colorway: "not tired black", format: "feed", nameColor: "#FFFFFF" });
    expect(t.html).not.toContain("color:#252728");
    expect(t.html).toMatch(/\.name\{[^}]*color:#FFFFFF/);
  });

  it("báo lỗi với colorway không có trong rulebook", () => {
    expect(() => f1Html(rb, { photoJpeg, colorway: "hot red", format: "feed" })).toThrow(/hot red/);
  });
});

describe("vị trí nhãn sản phẩm", () => {
  afterAll(closeBrowser);

  const labelBox = async (format: "feed" | "story") => {
    const fmt = rb.visual.formats[format];
    const photo = await sharp({ create: { width: fmt.width, height: fmt.height, channels: 3, background: "#3B3D3F" } }).jpeg().toBuffer();
    const t = f1Html(rb, { photoJpeg: photo, colorway: "easy mint", format });
    const r = await renderHtml(t.html, t.width, t.height, t.fonts);
    return r.textBoxes.find((b) => b.id === "label")!;
  };

  it("Story: nhãn ở góc trên trái, ngay dưới vùng an toàn phía trên", async () => {
    const b = await labelBox("story");
    expect(b.y).toBeGreaterThanOrEqual(250);
    expect(b.y).toBeLessThanOrEqual(400);
    expect(b.x).toBeGreaterThanOrEqual(50);
    expect(b.x).toBeLessThanOrEqual(62);
  });

  it("Feed: nhãn ở góc dưới trái", async () => {
    const b = await labelBox("feed");
    expect(1350 - (b.y + b.height)).toBeLessThanOrEqual(100);
    expect(b.x).toBeLessThanOrEqual(62);
  });
});
