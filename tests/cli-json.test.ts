import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function cli(script: string, ...args: string[]) {
  const r = spawnSync("npx", ["tsx", `src/cli/${script}.ts`, ...args], { cwd: process.cwd(), encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe("CLI cards/post: JSON và tuỳ chọn", () => {
  const dir = mkdtempSync(join(tmpdir(), "cli-json-"));
  const broken = join(dir, "broken.json");
  writeFileSync(broken, "{ không phải json");
  const obj = join(dir, "obj.json");
  writeFileSync(obj, '{"a":1}');
  const noCards = join(dir, "cards.json");
  writeFileSync(noCards, "[]");

  it("cards: JSON hỏng → lỗi tiếng Việt, mã 1, không ghi gì", () => {
    const r = cli("cards", "--file", broken);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/Lỗi: Không đọc được .*broken\.json: JSON không hợp lệ/);
    expect(r.out).not.toMatch(/\n\s+at /);
    expect(readFileSync(broken, "utf8")).toBe("{ không phải json");
  });

  it("cards: không phải danh sách → lỗi, file giữ nguyên", () => {
    const r = cli("cards", "--file", obj);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/Lỗi: .*danh sách/);
    expect(readFileSync(obj, "utf8")).toBe('{"a":1}');
  });

  it("post: JSON hỏng → lỗi tiếng Việt, mã 1", () => {
    const r = cli("post", "--plan", broken, "--cards", noCards, "--check");
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/Lỗi: Không đọc được .*broken\.json: JSON không hợp lệ/);
  });

  it("post: kế hoạch sai cấu trúc → danh sách lỗi, mã 1", () => {
    const r = cli("post", "--plan", obj, "--cards", noCards, "--check");
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/Lỗi: Kế hoạch bài có/);
  });

  it("post: --check cùng --out → mã 2", () => {
    const r = cli("post", "--plan", obj, "--cards", noCards, "--check", "--out", join(dir, "o"));
    expect(r.code).toBe(2);
    expect(r.out).toContain("Cách dùng:");
  });

  it("post: thiếu --cards → mã 2, cả với --check lẫn --out", () => {
    const check = cli("post", "--plan", obj, "--check");
    expect(check.code).toBe(2);
    expect(check.out).toContain("Cách dùng:");
    expect(check.out).toContain("--cards <cards.json>");
    const out = cli("post", "--plan", obj, "--out", join(dir, "o2"));
    expect(out.code).toBe(2);
    expect(existsSync(join(dir, "o2"))).toBe(false);
  });
});
