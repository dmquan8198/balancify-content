import { describe, expect, it } from "vitest";
import { loadRulebook } from "../src/rulebook/load";
import { hasErrors, lintText } from "../src/lint/voice";

const { voice } = loadRulebook();
const rules = (text: string) => lintText(text, voice).map((i) => `${i.rule}:${i.match}`);

describe("lintText", () => {
  it("bắt từ xưng hô bị cấm", () => {
    expect(rules("Shop mới về túi")).toContain("forbidden:Shop");
    expect(rules("Bên em có sẵn hàng")).toContain("forbidden:Bên em");
  });

  it("không bắt 'shop' nằm trong từ khác", () => {
    expect(rules("Mình bán túi ở workshop")).not.toContain("forbidden:workshop");
  });

  it("bắt từ tiếng Anh và gợi ý từ thay", () => {
    const issues = lintText("Túi siêu soft luôn á", voice);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ rule: "english", match: "soft", suggestion: "mềm" });
    expect(lintText("Cái túi cozy ghê", voice)[0]).toMatchObject({ match: "cozy", suggestion: "êm" });
  });

  it("bắt từng từ tiếng Anh trong cụm", () => {
    expect(rules("mint green era")).toEqual(["english:mint", "english:green", "english:era"]);
  });

  it("bắt claim bị chặn", () => {
    expect(rules("Túi chống nước nhé")).toContain("blocked_claim:chống nước");
  });

  it("cảnh báo hashtag ngoài danh sách", () => {
    const issues = lintText("Túi mới #tuixinh", voice);
    expect(issues).toEqual([expect.objectContaining({ rule: "hashtag", severity: "warn", match: "#tuixinh" })]);
    expect(hasErrors(issues)).toBe(false);
  });

  it("câu mẫu trong rulebook đều đạt", () => {
    for (const example of voice.examples) expect(lintText(example, voice)).toEqual([]);
  });

  it("caption mở bán trong playbook đạt", () => {
    const caption =
      "Mình không làm ra một cái túi. Mình làm ra một cái ôm mang đi được.\n\n" +
      "Daily Hug Bag — nylon chần bông, mềm như gối, đựng vừa laptop 14\", nhẹ đến mức đeo cả ngày vai không biết.\n\n" +
      "460.000đ · lô đầu đúng 20 chiếc · comment HUG để mình nhắn riêng.\n\n#dailyhugbag #balancify";
    expect(lintText(caption, voice)).toEqual([]);
  });
});
