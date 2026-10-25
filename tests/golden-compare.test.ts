import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { preparePhoto } from "../src/render/prepare";
import { closeBrowser, renderHtml } from "../src/render/render";
import { loadRulebook } from "../src/rulebook/load";
import { f1Html } from "../src/templates/f1";
import { compareImages, MAX_CHANGED_SHARE } from "./golden-compare";
import { makeFlatlayFixture } from "./fixtures/flatlay";

afterAll(closeBrowser);

describe("compareImages", () => {
  const storyHtml = async () => {
    const rb = loadRulebook();
    const fmt = rb.visual.formats.story;
    const photoJpeg = await preparePhoto(await makeFlatlayFixture(), fmt.width, fmt.height);
    return f1Html(rb, { photoJpeg, colorway: "easy mint", format: "story" });
  };

  it("hai lần render giống nhau được coi là giống", async () => {
    const t = await storyHtml();
    const a = await renderHtml(t.html, t.width, t.height, t.fonts);
    const b = await renderHtml(t.html, t.width, t.height, t.fonts);
    const cmp = await compareImages(a.png, b.png);
    expect(cmp.same).toBe(true);
    expect(cmp.changedShare).toBeLessThanOrEqual(MAX_CHANGED_SHARE);
  });

  it("chỉ dời nhãn nhỏ cũng bị coi là khác", async () => {
    const t = await storyHtml();
    expect(t.html).toContain("left:56px;top:290px");
    const moved = t.html.replace("left:56px;top:290px", "left:56px;bottom:396px");
    const a = await renderHtml(t.html, t.width, t.height, t.fonts);
    const b = await renderHtml(moved, t.width, t.height, t.fonts);
    const cmp = await compareImages(a.png, b.png);
    expect(cmp.same).toBe(false);
    expect(cmp.changed).toBeGreaterThan(0);
  });

  it("khác kích thước thì khác", async () => {
    const a = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#000" } }).png().toBuffer();
    const b = await sharp({ create: { width: 10, height: 12, channels: 3, background: "#000" } }).png().toBuffer();
    expect((await compareImages(a, b)).same).toBe(false);
  });
});
