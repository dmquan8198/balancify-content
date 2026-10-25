import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  });

  it("kế hoạch có lỗi thì không dựng gì và ném PlanError liệt kê lỗi", async () => {
    const dir = mkdtempSync(join(tmpdir(), "post-"));
    const plan: PostPlan = { goal: "B", pillar: "FEEL", family: "F1", slides: [], caption: "", hashtags: [] };
    await expect(runPost(plan, join(dir, "out"))).rejects.toThrow(PlanError);
    expect(existsSync(join(dir, "out"))).toBe(false);
  });
});
