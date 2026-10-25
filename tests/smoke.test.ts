import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { chromium } from "playwright-core";

describe("môi trường", () => {
  it("sharp tạo được ảnh", async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#ffffff" } }).png().toBuffer();
    expect((await sharp(png).metadata()).width).toBe(4);
  });

  it("chromium khởi động được", async () => {
    const browser = await chromium.launch();
    expect(browser.isConnected()).toBe(true);
    await browser.close();
  });
});
