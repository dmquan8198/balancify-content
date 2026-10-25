import { describe, expect, it } from "vitest";
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

  it("báo lỗi với colorway không có trong rulebook", () => {
    expect(() => f1Html(rb, { photoJpeg, colorway: "hot red", format: "feed" })).toThrow(/hot red/);
  });
});
