import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { makeFlatlayFixture } from "./fixtures/flatlay";

// Spawned CLIs run from the repo root (they need rulebook/ and assets/), but every folder they
// write to (--out, photos, plans, cards) lives under a fresh os.tmpdir() directory.
const run = (script: string, ...args: string[]) => {
  const r = spawnSync("npx", ["tsx", `src/cli/${script}.ts`, ...args], { cwd: process.cwd(), encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};

const caption = "Mình không làm ra một cái túi. Mình làm ra một cái ôm mang đi được.";

describe("chuỗi ingest → contact → cards → post", () => {
  it("chạy trọn từ file tải về đến gói duyệt", async () => {
    const work = mkdtempSync(join(tmpdir(), "workflow-"));
    const download = join(work, "download.txt");
    const jpg = await makeFlatlayFixture();
    writeFileSync(download, JSON.stringify({ content: jpg.toString("base64"), id: "x1", mimeType: "image/jpeg", title: "flatlay mint.jpg" }));

    const photos = join(work, "photos");
    const first = run("ingest", "--out", photos, download);
    expect(first.code).toBe(0);
    const manifest = JSON.parse(readFileSync(join(photos, "photos.json"), "utf8"));
    expect(manifest.photos).toHaveLength(1);
    const file = manifest.photos[0].file as string;

    // Re-running ingest on the same download is safe: nothing is duplicated.
    const again = run("ingest", "--out", photos, download);
    expect(again.code).toBe(0);
    expect(again.out).toContain("Đã có sẵn");
    expect(JSON.parse(readFileSync(join(photos, "photos.json"), "utf8")).photos).toHaveLength(1);

    expect(run("contact", "--from", join(photos, "photos.json"), "--out", join(work, "sheet.jpg")).code).toBe(0);
    expect(existsSync(join(work, "sheet.jpg"))).toBe(true);

    // fits is never written by hand: the cards command measures it.
    const cards = join(work, "cards.json");
    writeFileSync(cards, JSON.stringify([{ file, colorway: "easy mint", kind: "flatlay", person: false, quality: "ok", focus: { x: 0.5, y: 0.5 }, note: "" }]));
    expect(run("cards", "--file", cards).code).toBe(0);
    expect(JSON.parse(readFileSync(cards, "utf8"))[0].fits).toEqual({ feed: true, story: true });

    const plan = join(work, "plan.json");
    writeFileSync(
      plan,
      JSON.stringify({
        goal: "C",
        pillar: "FEEL",
        family: "F1",
        slides: [{ photo: file, colorway: "easy mint", why: "Ảnh duy nhất, túi ở giữa." }],
        caption,
        hashtags: ["#dailyhugbag"],
      }),
    );
    const check = run("post", "--plan", plan, "--cards", cards, "--check");
    expect(check.code).toBe(0);
    expect(check.out).toContain("Kế hoạch hợp lệ.");

    const out = join(work, "out");
    const post = run("post", "--plan", plan, "--cards", cards, "--out", out);
    expect(post.out).toContain("KẾT QUẢ: ĐẠT");
    expect(post.code).toBe(0);
    expect(existsSync(join(out, "review.md"))).toBe(true);
    expect(existsSync(join(out, "slide-1", "f1-easy-mint-feed.png"))).toBe(true);
    expect(readFileSync(join(out, "review.md"), "utf8")).not.toContain(work);

    // Running again into the same --out replaces the previous pack.
    const second = run("post", "--plan", plan, "--cards", cards, "--out", out);
    expect(second.code).toBe(0);
    expect(second.out).toContain("KẾT QUẢ: ĐẠT");
    expect(existsSync(join(out, "review.md"))).toBe(true);
    expect(existsSync(photos) && existsSync(file)).toBe(true);

    // With an empty cards file the run has a warning; the CLI prints the same verdict line as review.md.
    const empty = join(work, "empty-cards.json");
    writeFileSync(empty, "[]");
    const warned = run("post", "--plan", plan, "--cards", empty, "--out", out);
    expect(warned.code).toBe(0);
    const reviewVerdict = readFileSync(join(out, "review.md"), "utf8").split("\n").find((l) => l.startsWith("KẾT QUẢ:"));
    expect(reviewVerdict).toBe("KẾT QUẢ: ĐẠT (1 cảnh báo — xem mục Cảnh báo)");
    expect(warned.out.split("\n").find((l) => l.startsWith("KẾT QUẢ:"))).toBe(reviewVerdict);
  });

  it("--out có tệp lạ: mã 1, báo lỗi tiếng Việt, tệp còn nguyên", async () => {
    const work = mkdtempSync(join(tmpdir(), "workflow-"));
    const photo = join(work, "photo.jpg");
    writeFileSync(photo, await makeFlatlayFixture());
    const plan = join(work, "plan.json");
    writeFileSync(
      plan,
      JSON.stringify({ goal: "C", pillar: "FEEL", family: "F1", slides: [{ photo, colorway: "easy mint", why: "x" }], caption, hashtags: ["#dailyhugbag"] }),
    );
    const folder = mkdtempSync(join(tmpdir(), "workflow-unrelated-"));
    const keep = join(folder, "keep.txt");
    writeFileSync(keep, "giữ lại");
    const cards = join(work, "cards.json");
    writeFileSync(cards, "[]");
    const r = run("post", "--plan", plan, "--cards", cards, "--out", folder);
    expect(r.code).toBe(1);
    expect(r.out).toContain("Lỗi: Thư mục --out đã có nội dung khác");
    expect(r.out).not.toMatch(/\n\s+at /);
    expect(readFileSync(keep, "utf8")).toBe("giữ lại");
    expect(existsSync(photo)).toBe(true);
  });

  it("--check và --out không dùng cùng lúc: mã 2", () => {
    const work = mkdtempSync(join(tmpdir(), "workflow-"));
    const plan = join(work, "plan.json");
    writeFileSync(plan, "{}");
    const cards = join(work, "cards.json");
    writeFileSync(cards, "[]");
    const r = run("post", "--plan", plan, "--cards", cards, "--check", "--out", join(work, "out"));
    expect(r.code).toBe(2);
    expect(existsSync(join(work, "out"))).toBe(false);
  });

  it("kế hoạch mục tiêu B: mã 1, lỗi tiếng Việt, không stack trace", () => {
    const work = mkdtempSync(join(tmpdir(), "workflow-"));
    const plan = join(work, "plan.json");
    writeFileSync(plan, JSON.stringify({ goal: "B", pillar: "FEEL", family: "F1", slides: [], caption: "", hashtags: [] }));
    const cards = join(work, "cards.json");
    writeFileSync(cards, "[]");
    const r = run("post", "--plan", plan, "--cards", cards, "--check");
    expect(r.code).toBe(1);
    expect(r.out.trimStart().startsWith("Lỗi: Kế hoạch bài có")).toBe(true);
    expect(r.out).toMatch(/Mục tiêu B không thuộc trụ FEEL/);
    expect(r.out).not.toMatch(/\n\s+at /);
  });
});
