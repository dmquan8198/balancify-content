import { describe, expect, it } from "vitest";
import { loadRulebook, validate, RulebookError } from "../src/rulebook/load";

describe("rulebook", () => {
  it("nạp được 4 file và có 4 colorway", () => {
    const rb = loadRulebook();
    expect(rb.brand.product).toBe("Daily Hug Bag");
    expect(rb.voice.pronoun).toBe("mình");
    expect(Object.keys(rb.visual.colorways)).toEqual(["dreaming blue", "easy mint", "off duty pink", "not tired black"]);
    expect(rb.pillars.FEEL.family).toBe("F1");
  });

  it("báo lỗi rõ ràng khi màu colorway không phải hex", () => {
    const rb = loadRulebook();
    rb.visual.colorways["easy mint"] = { accent: "xanh" };
    expect(() => validate(rb)).toThrow(RulebookError);
    expect(() => validate(rb)).toThrow(/easy mint/);
  });

  it("báo lỗi khi thiếu thông tin sản phẩm", () => {
    const rb = loadRulebook();
    rb.brand.product_facts = [];
    expect(() => validate(rb)).toThrow(/product_facts/);
  });
});
