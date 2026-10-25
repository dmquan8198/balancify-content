import { describe, expect, it } from "vitest";
import { parseOrUsage, UsageError } from "../src/cli/run";
import { parseArgs } from "node:util";

describe("parseOrUsage", () => {
  it("tham số thừa → UsageError kèm gợi ý", () => {
    expect(() =>
      parseOrUsage(() => parseArgs({ args: ["a"], options: {} }), "gợi ý"),
    ).toThrow(new UsageError("gợi ý"));
  });

  it("tuỳ chọn lạ → UsageError không gợi ý", () => {
    expect(() => parseOrUsage(() => parseArgs({ args: ["--x"], options: {} }), "gợi ý")).toThrow(new UsageError(""));
  });

  it("lỗi khác được ném lại nguyên vẹn", () => {
    expect(() => parseOrUsage(() => { throw new RangeError("khác"); })).toThrow(RangeError);
  });
});
