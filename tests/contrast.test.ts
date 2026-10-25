import { describe, expect, it } from "vitest";
import { contrastRatio, hexToRgb, parseCssColor } from "../src/checks/contrast";

describe("contrast", () => {
  it("trắng/đen là 21:1, cùng màu là 1:1", () => {
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5);
    expect(contrastRatio([120, 120, 120], [120, 120, 120])).toBeCloseTo(1, 5);
  });

  it("#777777 trên nền trắng xấp xỉ 4.48", () => {
    expect(contrastRatio(hexToRgb("#777777"), hexToRgb("#FFFFFF"))).toBeCloseTo(4.48, 2);
  });

  it("đọc được màu CSS rgb() và rgba()", () => {
    expect(parseCssColor("rgb(178, 207, 234)")).toEqual([178, 207, 234]);
    expect(parseCssColor("rgba(1, 2, 3, 1)")).toEqual([1, 2, 3]);
  });

  it("từ chối màu trong suốt hoặc không phải số", () => {
    expect(() => parseCssColor("rgba(0, 0, 0, 0)")).toThrow(/trong suốt/);
    expect(() => parseCssColor("rgb(255 255 255 / 0.2)")).toThrow(/trong suốt/);
    expect(() => parseCssColor("rgb(50%, 0, 0)")).toThrow(Error);
  });

  it("hexToRgb từ chối chuỗi không phải hex 6 số", () => {
    for (const bad of ["#FFF", "FFFFFF", "xanh"]) expect(() => hexToRgb(bad)).toThrow(Error);
  });
});
