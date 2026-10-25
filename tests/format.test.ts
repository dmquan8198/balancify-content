import { describe, expect, it } from "vitest";
import { verdictLine } from "../src/post/format";

describe("verdictLine", () => {
  it("đạt, đạt có cảnh báo, có lỗi", () => {
    expect(verdictLine(true, 0)).toBe("KẾT QUẢ: ĐẠT");
    expect(verdictLine(true, 2)).toBe("KẾT QUẢ: ĐẠT (2 cảnh báo — xem mục Cảnh báo)");
    expect(verdictLine(false, 3)).toBe("KẾT QUẢ: CÓ LỖI");
  });
});
