import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { makeFlatlayFixture } from "./fixtures/flatlay";

function cli(...args: string[]) {
  const r = spawnSync("npx", ["tsx", "src/cli/f1.ts", ...args], { cwd: process.cwd(), encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

const noStack = (out: string) => {
  expect(out).not.toMatch(/TypeError|Node\.js v|\n\s+at /);
};

describe("CLI f1", () => {
  const out = mkdtempSync(join(tmpdir(), "cli-"));

  it("colorway không đặt trong ngoặc kép: mã 2 và gợi ý tiếng Việt", () => {
    const r = cli("--photo", "x.jpg", "--colorway", "easy", "mint", "--out", out);
    expect(r.code).toBe(2);
    expect(r.out).toContain("Cách dùng:");
    expect(r.out).toContain('Tên colorway có khoảng trắng — hãy đặt trong ngoặc kép, ví dụ --colorway "easy mint"');
    noStack(r.out);
  });

  it("tuỳ chọn lạ: mã 2 và in cách dùng", () => {
    const r = cli("--photo", "x.jpg", "--colorway", "easy mint", "--mau", "x");
    expect(r.code).toBe(2);
    expect(r.out).toContain("Cách dùng:");
    noStack(r.out);
  });

  it("không có file ảnh: mã 1, chỉ in lỗi, không stack trace", () => {
    const r = cli("--photo", "/khong/co/anh.jpg", "--colorway", "easy mint", "--out", out);
    expect(r.code).toBe(1);
    expect(r.out.trimStart().startsWith("Lỗi: Không tìm thấy file ảnh")).toBe(true);
    noStack(r.out);
  });

  it("colorway sai: mã 1, liệt kê tên hợp lệ", () => {
    const r = cli("--photo", "/khong/co/anh.jpg", "--colorway", "hot red", "--out", out);
    expect(r.code).toBe(1);
    expect(r.out.trimStart()).toMatch(/^Lỗi: Không có colorway "hot red".*easy mint/);
    noStack(r.out);
  });

  it("nhiều lỗi được nối gọn, không có \".;\"", async () => {
    const photo = join(out, "light.jpg");
    writeFileSync(photo, await makeFlatlayFixture("#B8C6B8", "#F4F2EE"));
    const r = cli("--photo", photo, "--colorway", "easy mint", "--out", out);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/feed: .*; /);
    expect(r.out).not.toContain(".;");
    expect(r.out).not.toContain("đổi sang trắng");
  });
});
