import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { runF1, slug } from "../src/pipeline/f1";
import { closeBrowser } from "../src/render/render";
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

    const feed = await sharp(join(outDir, "f1-easy-mint-feed.png")).metadata();
    const story = await sharp(join(outDir, "f1-easy-mint-story.png")).metadata();
    expect([feed.width, feed.height]).toEqual([1080, 1350]);
    expect([story.width, story.height]).toEqual([1080, 1920]);

    expect(existsSync(join(outDir, "report.json"))).toBe(true);
    expect(JSON.parse(readFileSync(join(outDir, "report.json"), "utf8")).ok).toBe(true);
  });

  it("báo lỗi rõ khi colorway sai", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "f1-"));
    await expect(runF1({ photo: await makeFlatlayFixture(), colorway: "hot red", outDir })).rejects.toThrow(/hot red/);
  });
});
