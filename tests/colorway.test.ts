import { describe, expect, it } from "vitest";
import { ColorwayError, findColorway } from "../src/rulebook/colorway";
import { loadRulebook } from "../src/rulebook/load";
import { f1Html } from "../src/templates/f1";

const rb = loadRulebook();

describe("findColorway", () => {
  it("khớp tên không phân biệt hoa thường, khoảng trắng hay gạch nối", () => {
    for (const input of ["easy mint", "Easy Mint", "easy-mint", "  EASY   MINT "]) {
      expect(findColorway(rb.visual, input).name).toBe("easy mint");
    }
    expect(findColorway(rb.visual, "Easy Mint").colorway.accent).toBe("#B8C6B8");
  });

  it("không có thì báo lỗi kèm danh sách tên hợp lệ", () => {
    expect(() => findColorway(rb.visual, "hot red")).toThrow(ColorwayError);
    expect(() => findColorway(rb.visual, "hot red")).toThrow(/hot red.*dreaming blue, easy mint, off duty pink, not tired black/);
  });

  it("template dùng cùng cách tìm và in tên chuẩn", () => {
    const t = f1Html(rb, { photoJpeg: Buffer.from("x"), colorway: "Easy-Mint", format: "feed" });
    expect(t.html).toContain(">easy mint<");
    expect(t.html).toContain("color:#B8C6B8");
    expect(() => f1Html(rb, { photoJpeg: Buffer.from("x"), colorway: "hot red", format: "feed" })).toThrow(ColorwayError);
  });
});
