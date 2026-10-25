import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PhotoCard } from "../src/cards/cards";
import { validatePlan, type PostPlan } from "../src/post/plan";
import { loadRulebook } from "../src/rulebook/load";

const rb = loadRulebook();
const dir = mkdtempSync(join(tmpdir(), "plan-"));
const photo = join(dir, "a.jpg");
writeFileSync(photo, "x");

const plan = (over: Partial<PostPlan> = {}): PostPlan => ({
  goal: "C",
  pillar: "FEEL",
  family: "F1",
  slides: [{ photo, colorway: "easy mint", why: "Túi nằm giữa, đồ phối cùng tông." }],
  caption: "Mình không làm ra một cái túi. Mình làm ra một cái ôm mang đi được.",
  hashtags: ["#dailyhugbag"],
  ...over,
});

const errors = (p: PostPlan, cards: PhotoCard[] = []) => validatePlan(p, rb, cards).filter((i) => i.severity === "error").map((i) => i.message);

describe("validatePlan", () => {
  it("kế hoạch đúng thì không có lỗi", () => {
    expect(errors(plan())).toEqual([]);
  });

  it("mục tiêu B với F1 bị chặn, nói rõ lý do", () => {
    expect(errors(plan({ goal: "B" })).join("\n")).toMatch(/Mục tiêu B không thuộc trụ FEEL/);
  });

  it("họ template chưa xây bị chặn", () => {
    expect(errors(plan({ pillar: "REAL", family: "F2" })).join("\n")).toMatch(/F2 chưa được xây/);
  });

  it("số slide F1 phải từ 1 đến 4", () => {
    expect(errors(plan({ slides: [] })).join("\n")).toMatch(/1–4 slide/);
  });

  it("ảnh không tồn tại, colorway sai, caption sai giọng", () => {
    const msg = errors(
      plan({ slides: [{ photo: join(dir, "khong-co.jpg"), colorway: "hot red", why: "x" }], caption: "Shop mới về túi siêu soft" }),
    ).join("\n");
    expect(msg).toMatch(/Không tìm thấy ảnh/);
    expect(msg).toMatch(/hot red/);
    expect(msg).toMatch(/shop/i);
    expect(msg).toMatch(/soft/);
  });

  it("dùng thẻ ảnh: ảnh kém, sai kiểu, không đủ lớn", () => {
    const card: PhotoCard = {
      file: photo,
      colorway: "easy mint",
      kind: "lifestyle",
      person: true,
      quality: "blurry",
      focus: { x: 0.5, y: 0.5 },
      note: "",
      fits: { feed: true, story: false },
    };
    const msg = errors(plan(), [card]).join("\n");
    expect(msg).toMatch(/chất lượng/);
    expect(msg).toMatch(/flatlay/);
    expect(msg).toMatch(/Story/);
  });

  it("hashtag phải bắt đầu bằng #", () => {
    expect(errors(plan({ hashtags: ["dailyhugbag"] })).join("\n")).toMatch(/#/);
  });

  it("thẻ ảnh: colorway null hoặc khác colorway của slide", () => {
    const base: PhotoCard = { file: photo, colorway: "easy mint", kind: "flatlay", person: false, quality: "ok", focus: { x: 0.5, y: 0.5 }, note: "", fits: { feed: true, story: true } };
    expect(errors(plan(), [{ ...base, colorway: null }]).join("\n")).toMatch(/chưa xác định colorway/);
    const msg = errors(plan(), [{ ...base, colorway: "Not Tired Black" }]).join("\n");
    expect(msg).toMatch(/not tired black/);
    expect(msg).toMatch(/easy mint/);
    expect(errors(plan(), [base])).toEqual([]);
  });

  it("có cards.json mà ảnh không có thẻ, hoặc thẻ chưa có fits", () => {
    const other: PhotoCard = { file: join(dir, "other.jpg"), colorway: "easy mint", kind: "flatlay", person: false, quality: "ok", focus: { x: 0.5, y: 0.5 }, note: "", fits: { feed: true, story: true } };
    expect(errors(plan(), [other]).join("\n")).toMatch(/không có thẻ trong cards\.json/);
    const nofits: PhotoCard = { ...other, file: photo };
    delete nofits.fits;
    expect(errors(plan(), [nofits]).join("\n")).toMatch(/npm run cards/);
  });

  it("focus của slide phải nằm trong 0..1", () => {
    const slide = { photo, colorway: "easy mint", why: "x", focus: { x: 2, y: Number.NaN } };
    expect(errors(plan({ slides: [slide] })).join("\n")).toMatch(/focus/);
  });

  it("sai cấu trúc thì báo lỗi, không ném", () => {
    const bads: unknown[] = [
      null,
      "x",
      { ...plan(), slides: undefined },
      { ...plan(), hashtags: undefined },
      { ...plan(), hashtags: "#a" },
      { ...plan(), hashtags: [5] },
      { ...plan(), caption: 5 },
      { ...plan(), slides: [null] },
      { ...plan(), slides: [{ photo, why: "x" }] },
    ];
    for (const b of bads) {
      const issues = validatePlan(b as PostPlan, rb, []);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.every((i) => i.severity === "error")).toBe(true);
    }
  });

  it("cùng ảnh ở hai slide thì cảnh báo; thư mục không phải ảnh thì lỗi", () => {
    const two = plan({ slides: [{ photo, colorway: "easy mint", why: "a" }, { photo, colorway: "not tired black", why: "b" }] });
    expect(validatePlan(two, rb, []).filter((i) => i.severity === "warn").map((i) => i.message).join("\n")).toMatch(/cùng ảnh/);
    expect(errors(plan({ slides: [{ photo: dir, colorway: "easy mint", why: "x" }] })).join("\n")).toMatch(/Không tìm thấy ảnh/);
  });

  it("hashtag chỉ gồm chữ, số, gạch dưới", () => {
    expect(errors(plan({ hashtags: ["#a b"] })).join("\n")).toMatch(/Hashtag/);
    expect(errors(plan({ hashtags: ["#túi_xinh1"] }))).toEqual([]);
  });
});
