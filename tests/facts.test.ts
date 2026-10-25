import { describe, expect, it } from "vitest";
import { extractClaims, unsupportedClaims } from "../src/lint/facts";
import { validatePlan, type PostPlan } from "../src/post/plan";
import { loadRulebook } from "../src/rulebook/load";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const rb = loadRulebook();
const facts = rb.brand.product_facts;
const bad = (text: string) => unsupportedClaims(text, facts).map((c) => c.match);

describe("extractClaims", () => {
  it("chuẩn hoá tiền về số nguyên VND", () => {
    const keys = (t: string) => extractClaims(t).map((c) => c.key);
    expect(keys("giá 460.000đ")).toEqual(["money:460000"]);
    expect(keys("460k")).toEqual(["money:460000"]);
    expect(keys("460 nghìn, 460 ngàn")).toEqual(["money:460000", "money:460000"]);
    expect(keys("1tr hoặc 1 triệu")).toEqual(["money:1000000", "money:1000000"]);
    expect(keys("1tr5")).toEqual(["money:1500000"]);
    expect(keys("460.000 VND")).toEqual(["money:460000"]);
  });

  it("khối lượng về gram, kích thước về inch", () => {
    const keys = (t: string) => extractClaims(t).map((c) => c.key);
    expect(keys("nặng 200g")).toEqual(["weight:200"]);
    expect(keys("1kg")).toEqual(["weight:1000"]);
    expect(keys("1,2kg")).toEqual(["weight:1200"]);
    expect(keys('laptop 14"')).toEqual(["size:14"]);
    expect(keys("laptop 14 inch")).toEqual(["size:14"]);
  });

  it("số đếm, phần trăm, giờ không phải claim", () => {
    expect(extractClaims("lô đầu đúng 20 chiếc, giảm 80%, giao 2h, 4 colorway")).toEqual([]);
  });
});

describe("unsupportedClaims", () => {
  it("con số có trong product_facts thì được nói", () => {
    expect(bad("giá 460.000đ")).toEqual([]);
    expect(bad("chỉ 460k thôi")).toEqual([]);
    expect(bad('đựng vừa laptop 14"')).toEqual([]);
    expect(bad("đựng vừa laptop 14 inch")).toEqual([]);
  });

  it("con số ngoài product_facts bị bắt", () => {
    expect(bad("giá 400.000đ")).toEqual(["400.000đ"]);
    expect(bad("chỉ 399k")).toEqual(["399k"]);
    expect(bad("nhẹ 200g")).toEqual(["200g"]);
    expect(bad('vừa laptop 13"')).toEqual(['13"']);
  });
});

describe("validatePlan: con số trong caption", () => {
  const dir = mkdtempSync(join(tmpdir(), "facts-"));
  const photo = join(dir, "a.jpg");
  writeFileSync(photo, "x");
  const plan = (caption: string): PostPlan => ({
    goal: "C",
    pillar: "FEEL",
    family: "F1",
    slides: [{ photo, colorway: "easy mint", why: "x" }],
    caption,
    hashtags: ["#dailyhugbag"],
  });
  const errors = (caption: string) => validatePlan(plan(caption), rb, []).filter((i) => i.severity === "error").map((i) => i.message);

  it("caption có giá sai → lỗi nêu con số", () => {
    expect(errors("Túi giá 399k nha.")).toEqual([
      'Caption: con số "399k" không có trong thông tin sản phẩm được phép nói (rulebook/brand.yaml).',
    ]);
  });

  it("caption mở bán trong playbook vẫn đạt", () => {
    const caption =
      "Mình không làm ra một cái túi. Mình làm ra một cái ôm mang đi được.\n\n" +
      "Daily Hug Bag — nylon chần bông, mềm như gối, đựng vừa laptop 14\", nhẹ đến mức đeo cả ngày vai không biết.\n\n" +
      "460.000đ · lô đầu đúng 20 chiếc · comment HUG để mình nhắn riêng.";
    expect(errors(caption)).toEqual([]);
  });
});
