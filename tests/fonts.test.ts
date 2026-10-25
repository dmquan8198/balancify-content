import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadRulebook } from "../src/rulebook/load";
import { fontFaceCss } from "../src/templates/fonts";

const rb = loadRulebook();

describe("fonts", () => {
  it("mọi font trong rulebook có file", () => {
    for (const f of Object.values(rb.visual.fonts)) expect(existsSync(f.file), f.file).toBe(true);
  });

  it("sinh @font-face cho từng font", () => {
    const css = fontFaceCss(rb);
    expect(css.match(/@font-face/g)).toHaveLength(4);
    expect(css).toContain('font-family:"Patrick Hand"');
    expect(css).toContain("font-weight:600");
  });
});
