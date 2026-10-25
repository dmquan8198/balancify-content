import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli, parseOrUsage, UsageError } from "../src/cli/run";
import { PhotoError } from "../src/render/prepare";
import { parseArgs } from "node:util";

describe("parseOrUsage", () => {
  it("tham số thừa → UsageError kèm gợi ý", () => {
    expect(() =>
      parseOrUsage(() => parseArgs({ args: ["a"], options: {} }), "gợi ý"),
    ).toThrow(new UsageError("gợi ý"));
    expect(() => parseOrUsage(() => parseArgs({ args: ["a"], options: {} }), "gợi ý")).toThrow(UsageError);
  });

  it("tuỳ chọn lạ → UsageError không gợi ý", () => {
    expect(() => parseOrUsage(() => parseArgs({ args: ["--x"], options: {} }), "gợi ý")).toThrow(new UsageError(""));
    expect(() => parseOrUsage(() => parseArgs({ args: ["--x"], options: {} }), "gợi ý")).toThrow(UsageError);
  });

  it("lỗi khác được ném lại nguyên vẹn", () => {
    expect(() => parseOrUsage(() => { throw new RangeError("khác"); })).toThrow(RangeError);
  });
});

describe("runCli", () => {
  const original = process.exitCode;
  afterEach(() => {
    process.exitCode = original;
    vi.restoreAllMocks();
  });

  const run = async (main: () => Promise<number>) => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await runCli("CÁCH DÙNG", main);
    return err.mock.calls.map((c) => c.join(" "));
  };

  it("trả mã thoát của main", async () => {
    expect(await run(async () => 0)).toEqual([]);
    expect(process.exitCode).toBe(0);
  });

  it("UsageError → in cách dùng và thông báo, mã 2", async () => {
    expect(await run(async () => { throw new UsageError("x"); })).toEqual(["CÁCH DÙNG", "x"]);
    expect(process.exitCode).toBe(2);
  });

  it("lỗi đã biết → 'Lỗi: …', mã 1", async () => {
    expect(await run(async () => { throw new PhotoError("p"); })).toEqual(["Lỗi: p"]);
    expect(process.exitCode).toBe(1);
  });

  it("lỗi lạ → 'Lỗi không mong đợi: …', mã 1", async () => {
    expect(await run(async () => { throw new Error("boom"); })).toEqual(["Lỗi không mong đợi: boom"]);
    expect(process.exitCode).toBe(1);
  });
});
