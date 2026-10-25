import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { runF1, slug } from "../src/pipeline/f1";
import { preparePhoto } from "../src/render/prepare";
import { closeBrowser, renderHtml } from "../src/render/render";
import { loadRulebook } from "../src/rulebook/load";
import { f1Html } from "../src/templates/f1";
import { makeFlatlayFixture } from "./fixtures/flatlay";

afterAll(closeBrowser);

describe("slug", () => {
  it("bỏ dấu và khoảng trắng", () => {
    expect(slug("Easy Mint")).toBe("easy-mint");
    expect(slug("Đi làm vui")).toBe("di-lam-vui");
  });

  it("mã nguồn không chứa ký tự tổ hợp (dấu) dạng thô", () => {
    const src = readFileSync(join(process.cwd(), "src/pipeline/f1.ts"), "utf8");
    expect(src).not.toMatch(/[\u0300-\u036f]/);
  });
});

describe("runF1", () => {
  it("xuất Feed + Story, báo cáo đạt", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "f1-"));
    const report = await runF1({ photo: await makeFlatlayFixture(), colorway: "easy mint", outDir });

    expect(report.ok).toBe(true);
    expect(report.lint).toEqual([]);
    expect(report.formats.map((f) => f.format)).toEqual(["feed", "story"]);
    for (const f of report.formats) expect(f.checks).toEqual([]);
    expect(report.formats.map((f) => f.nameColor)).toEqual(["accent", "accent"]);

    const feed = await sharp(join(outDir, "f1-easy-mint-feed.png")).metadata();
    const story = await sharp(join(outDir, "f1-easy-mint-story.png")).metadata();
    expect([feed.width, feed.height]).toEqual([1080, 1350]);
    expect([story.width, story.height]).toEqual([1080, 1920]);

    expect(existsSync(join(outDir, "report.json"))).toBe(true);
    expect(JSON.parse(readFileSync(join(outDir, "report.json"), "utf8")).ok).toBe(true);
  });

  it("tên colorway đổi sang trắng khi màu túi không đủ tương phản", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "f1-"));
    const photo = await makeFlatlayFixture("#252728");
    const report = await runF1({ photo, colorway: "not tired black", outDir });

    expect(report.ok).toBe(true);
    expect(report.formats.map((f) => f.nameColor)).toEqual(["fallback", "fallback"]);
    for (const f of report.formats) expect(f.checks).toEqual([]);

    // Glyph pixels of the name in the written PNG must be near-white.
    const rb = loadRulebook();
    for (const f of report.formats) {
      const fmt = rb.visual.formats[f.format];
      const t = f1Html(rb, { photoJpeg: await preparePhoto(photo, fmt.width, fmt.height), colorway: "not tired black", format: f.format });
      const r = await renderHtml(t.html, t.width, t.height, t.fonts);
      const box = r.textBoxes.find((b) => b.id === "colorway-name")!;
      const mask = await sharp(r.glyphMask).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const out = await sharp(readFileSync(f.file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const W = mask.info.width;
      let n = 0;
      let sum = 0;
      for (let y = Math.max(0, Math.floor(box.y)); y < Math.min(mask.info.height, Math.ceil(box.y + box.height)); y++) {
        for (let x = Math.max(0, Math.floor(box.x)); x < Math.min(W, Math.ceil(box.x + box.width)); x++) {
          const i = (y * W + x) * 3;
          if (mask.data[i] >= 32) continue;
          n++;
          sum += Math.min(out.data[i], out.data[i + 1], out.data[i + 2]);
        }
      }
      expect(n).toBeGreaterThan(100);
      expect(sum / n).toBeGreaterThan(230);
    }
  });

  it("nền sáng: giữ màu túi nếu màu trắng còn tệ hơn, và báo cần ảnh khác", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "f1-"));
    const report = await runF1({ photo: await makeFlatlayFixture("#B8C6B8", "#F4F2EE"), colorway: "easy mint", outDir });
    expect(report.ok).toBe(false);
    for (const f of report.formats) {
      expect(f.nameColor).toBe("accent");
      expect(f.checks.map((c) => c.message)).toContain(
        "Cả màu túi và màu trắng đều không đủ tương phản cho tên colorway — cần ảnh khác hoặc đổi điểm lấy nét (--focus-x/--focus-y).",
      );
    }
  });

  it("nhận tên colorway viết hoa hoặc có gạch nối", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "f1-"));
    const report = await runF1({ photo: await makeFlatlayFixture(), colorway: "Easy-Mint", outDir });
    expect(report.colorway).toBe("easy mint");
    expect(report.formats[0].file).toBe(join(outDir, "f1-easy-mint-feed.png"));
  });

  it("báo lỗi rõ khi colorway sai", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "f1-"));
    await expect(runF1({ photo: await makeFlatlayFixture(), colorway: "hot red", outDir })).rejects.toThrow(/hot red.*easy mint/);
  });
});
