import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { PlanError, type PostPlan } from "../src/post/plan";
import { runPost } from "../src/post/run";
import { closeBrowser } from "../src/render/render";
import { makeFlatlayFixture } from "./fixtures/flatlay";

afterAll(closeBrowser);

describe("runPost", () => {
  it("dựng carousel 2 slide và tạo gói duyệt", async () => {
    const dir = mkdtempSync(join(tmpdir(), "post-"));
    const mint = join(dir, "mint.jpg");
    const black = join(dir, "black.jpg");
    writeFileSync(mint, await makeFlatlayFixture());
    writeFileSync(black, await makeFlatlayFixture("#252728"));
    const plan: PostPlan = {
      goal: "C",
      pillar: "FEEL",
      family: "F1",
      slides: [
        { photo: mint, colorway: "easy mint", why: "Túi giữa khung, đồ phối cùng tông." },
        { photo: black, colorway: "not tired black", why: "Tương phản mạnh với slide 1." },
      ],
      caption: "Mình không làm ra một cái túi. Mình làm ra một cái ôm mang đi được.",
      hashtags: ["#dailyhugbag", "#balancify"],
    };
    const out = join(dir, "out");
    const r = await runPost(plan, out);

    expect(r.ok).toBe(true);
    expect(r.slides.map((s) => s.report.colorway)).toEqual(["easy mint", "not tired black"]);
    for (const s of r.slides) for (const f of s.report.formats) expect(existsSync(f.file)).toBe(true);
    expect(existsSync(join(out, "slide-1", "f1-easy-mint-feed.png"))).toBe(true);
    expect(existsSync(r.previewFile)).toBe(true);
    expect(readFileSync(r.captionFile, "utf8")).toBe(`${plan.caption}\n\n#dailyhugbag #balancify\n`);

    const review = readFileSync(r.reviewFile, "utf8");
    expect(review).toContain("KẾT QUẢ: ĐẠT");
    expect(review).toContain("## Slide 2 — not tired black");
    expect(review).toContain("Tương phản mạnh với slide 1.");
    expect(review).toContain("đổi sang trắng");
    expect(review).toContain("slide-1/f1-easy-mint-feed.png");
    expect(review).not.toContain(dir);
  });

  const threeSlides = async (dir: string): Promise<PostPlan> => {
    const files = await Promise.all(
      ["a", "b", "c"].map(async (n) => {
        const f = join(dir, `${n}.jpg`);
        writeFileSync(f, await makeFlatlayFixture());
        return f;
      }),
    );
    return {
      goal: "C",
      pillar: "FEEL",
      family: "F1",
      slides: [
        { photo: files[0], colorway: "easy mint", why: "a" },
        { photo: files[1], colorway: "not tired black", why: "b" },
        { photo: files[2], colorway: "easy mint", why: "c" },
      ],
      caption: "Mình không làm ra một cái túi. Mình làm ra một cái ôm mang đi được.",
      hashtags: ["#dailyhugbag"],
    };
  };

  it("chạy lại vào cùng thư mục thì thay hẳn kết quả cũ, không còn slide thừa", async () => {
    const dir = mkdtempSync(join(tmpdir(), "post-"));
    const plan = await threeSlides(dir);
    const out = join(dir, "out");
    await runPost(plan, out);
    expect(existsSync(join(out, "slide-3"))).toBe(true);

    const second: PostPlan = { ...plan, slides: [{ ...plan.slides[0], colorway: "not tired black" }] };
    const r = await runPost(second, out);
    expect(readdirSync(out).filter((n) => n.startsWith("slide-"))).toEqual(["slide-1"]);
    expect(existsSync(join(out, "slide-1", "f1-not-tired-black-feed.png"))).toBe(true);
    expect(existsSync(join(out, "slide-1", "f1-easy-mint-feed.png"))).toBe(false);
    for (const f of r.slides[0].report.formats) expect(existsSync(f.file)).toBe(true);
    expect(readdirSync(dir).filter((n) => n.includes(".tmp-"))).toEqual([]);
  });

  it("ảnh quá nhỏ thì ném lỗi trước khi dựng, thư mục cũ giữ nguyên", async () => {
    const dir = mkdtempSync(join(tmpdir(), "post-"));
    const plan = await threeSlides(dir);
    const out = join(dir, "out");
    await runPost(plan, out);
    const before = readFileSync(join(out, "review.md"), "utf8");

    const tiny = join(dir, "tiny.jpg");
    writeFileSync(tiny, await sharp({ create: { width: 600, height: 600, channels: 3, background: "#777" } }).jpeg().toBuffer());
    const bad: PostPlan = { ...plan, slides: [plan.slides[0], { photo: tiny, colorway: "not tired black", why: "x" }] };
    await expect(runPost(bad, out)).rejects.toThrow(/Slide 2: ảnh 600×600 không đủ lớn cho Feed/);
    expect(readFileSync(join(out, "review.md"), "utf8")).toBe(before);
    expect(existsSync(join(out, "slide-3"))).toBe(true);
    expect(readdirSync(dirname(out)).filter((n) => n.startsWith(`${basename(out)}.tmp-`))).toEqual([]);
  });

  it("có cảnh báo thì dòng kết quả ghi số cảnh báo", async () => {
    const dir = mkdtempSync(join(tmpdir(), "post-"));
    const plan = await threeSlides(dir); // slide 3 repeats easy mint -> warning
    const r = await runPost(plan, join(dir, "out"));
    expect(readFileSync(r.reviewFile, "utf8")).toMatch(/KẾT QUẢ: ĐẠT \(\d+ cảnh báo — xem mục Cảnh báo\)/);
  });

  it("kế hoạch có lỗi thì không dựng gì và ném PlanError liệt kê lỗi", async () => {
    const dir = mkdtempSync(join(tmpdir(), "post-"));
    const plan: PostPlan = { goal: "B", pillar: "FEEL", family: "F1", slides: [], caption: "", hashtags: [] };
    await expect(runPost(plan, join(dir, "out"))).rejects.toThrow(PlanError);
    expect(existsSync(join(dir, "out"))).toBe(false);
  });
});
