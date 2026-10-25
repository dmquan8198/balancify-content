import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  const bad = (mutate: (rb: any) => void, field: RegExp) => {
    const rb: any = loadRulebook();
    mutate(rb);
    expect(() => validate(rb)).toThrow(RulebookError);
    expect(() => validate(rb)).toThrow(field);
  };

  it("brand.product không được rỗng", () => {
    bad((rb) => (rb.brand.product = ""), /brand\.product/);
    bad((rb) => delete rb.brand.product, /brand\.product/);
  });

  it("các danh sách voice phải là mảng chuỗi không rỗng", () => {
    for (const key of ["forbidden", "blocked_claims", "hashtags_allowed"]) {
      bad((rb) => (rb.voice[key] = "x"), new RegExp(key));
      bad((rb) => (rb.voice[key] = [""]), new RegExp(key));
      bad((rb) => (rb.voice[key] = [1]), new RegExp(key));
    }
    for (const key of ["phrases", "words"]) {
      bad((rb) => (rb.voice.english_allowed[key] = null), new RegExp(key));
      bad((rb) => (rb.voice.english_allowed[key] = [""]), new RegExp(key));
    }
    bad((rb) => delete rb.voice.english_allowed, /english_allowed/);
  });

  it("hashtags_allowed phải bắt đầu bằng #", () => {
    bad((rb) => (rb.voice.hashtags_allowed = ["dailyhugbag"]), /hashtags_allowed/);
  });

  it("voice.replacements phải là object với giá trị chuỗi không rỗng", () => {
    bad((rb) => (rb.voice.replacements = null), /replacements/);
    bad((rb) => (rb.voice.replacements = { soft: "" }), /replacements/);
    bad((rb) => (rb.voice.replacements = { soft: 1 }), /replacements/);
  });

  it("pronoun không được nằm trong forbidden", () => {
    bad((rb) => rb.voice.forbidden.push("Mình"), /pronoun/);
  });

  it("neutrals, colorways, pillars phải là object hợp lệ", () => {
    bad((rb) => (rb.visual.neutrals = null), /neutrals/);
    bad((rb) => (rb.visual.colorways = null), /colorways/);
    bad((rb) => (rb.visual.colorways["easy mint"] = null), /easy mint/);
    bad((rb) => (rb.pillars = null), /pillars/);
  });

  it("formats phải có kích thước nguyên dương", () => {
    bad((rb) => (rb.visual.formats.feed.width = 0), /formats\.feed/);
    bad((rb) => (rb.visual.formats.story.height = 1920.5), /formats\.story/);
    bad((rb) => (rb.visual.formats.story.safe_top = -1), /safe_top/);
    bad((rb) => (rb.visual.formats.story.safe_bottom = 1.5), /safe_bottom/);
    bad((rb) => delete rb.visual.formats.feed, /formats\.feed/);
  });

  it("contrast phải là số dương", () => {
    for (const key of ["min_small", "min_large", "large_px"]) {
      bad((rb) => (rb.visual.contrast[key] = 0), new RegExp(key));
      bad((rb) => (rb.visual.contrast[key] = "4.5"), new RegExp(key));
    }
    bad((rb) => (rb.visual.contrast = undefined), /contrast/);
  });

  it("mỗi pillar phải có goals và photo hợp lệ", () => {
    bad((rb) => (rb.pillars.FEEL.goals = []), /FEEL.*goals/);
    bad((rb) => (rb.pillars.FEEL.goals = ["X"]), /FEEL.*goals/);
    bad((rb) => (rb.pillars.FEEL.photo = "selfie"), /FEEL.*photo/);
  });

  it("pillars.yaml rỗng báo RulebookError chứ không phải TypeError", () => {
    const dir = mkdtempSync(join(tmpdir(), "rb-"));
    for (const f of ["brand", "voice", "visual"]) cpSync(join(process.cwd(), "rulebook", `${f}.yaml`), join(dir, `${f}.yaml`));
    writeFileSync(join(dir, "pillars.yaml"), "");
    expect(() => loadRulebook(dir)).toThrow(RulebookError);
    expect(() => loadRulebook(dir)).toThrow(/pillars/);
  });
});
