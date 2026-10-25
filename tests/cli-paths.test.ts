import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertOutsideRepo, OutsideRepoError, REPO_ROOT } from "../src/cli/paths";

// Spawned CLIs run from the repo root; the only repo path they see is a relative --out that must be refused.
const run = (script: string, ...args: string[]) => {
  const r = spawnSync("npx", ["tsx", `src/cli/${script}.ts`, ...args], { cwd: process.cwd(), encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};

describe("assertOutsideRepo", () => {
  const base = mkdtempSync(join(tmpdir(), "paths-"));
  const repo = join(base, "repo");
  mkdirSync(join(repo, "sub"), { recursive: true });
  const elsewhere = join(base, "elsewhere");
  // tmpRoot points at an unrelated folder so the temp "repo" is not covered by the tmpdir exception.
  const noTmp = join(base, "not-tmp");

  it("từ chối thư mục trong repo, kể cả chính repo", () => {
    for (const p of [repo, join(repo, "out"), join(repo, "sub", "x", "y")]) {
      expect(() => assertOutsideRepo(p, repo, noTmp)).toThrow(OutsideRepoError);
    }
    expect(() => assertOutsideRepo(join(repo, "out"), repo, noTmp)).toThrow(
      `Thư mục ${join(repo, "out")} nằm trong repo — ảnh và kết quả phải ở ngoài repo (ví dụ thư mục scratchpad).`,
    );
  });

  it("cho phép thư mục ngoài repo, kể cả tên gần giống", () => {
    expect(() => assertOutsideRepo(elsewhere, repo, noTmp)).not.toThrow();
    expect(() => assertOutsideRepo(`${repo}-out`, repo, noTmp)).not.toThrow();
    expect(() => assertOutsideRepo(base, repo, noTmp)).not.toThrow();
  });

  it("thư mục dưới os.tmpdir() luôn được phép", () => {
    expect(() => assertOutsideRepo(join(repo, "out"), repo, base)).not.toThrow();
  });

  it("REPO_ROOT là thư mục chứa package.json của dự án", () => {
    expect(existsSync(join(REPO_ROOT, "package.json"))).toBe(true);
    expect(existsSync(join(REPO_ROOT, "rulebook", "brand.yaml"))).toBe(true);
  });
});

describe("CLI: --out trong repo bị từ chối", () => {
  const msg = /Lỗi: Thư mục .*out-should-not-exist-[0-9a-f]+ nằm trong repo — ảnh và kết quả phải ở ngoài repo/;

  it("ingest --out <thư mục trong repo> → mã 1, không tạo gì", () => {
    const name = `out-should-not-exist-${randomBytes(4).toString("hex")}`;
    expect(existsSync(join(REPO_ROOT, name))).toBe(false);
    const r = run("ingest", "--out", name, "x.jpg");
    expect(r.code).toBe(1);
    expect(r.out).toMatch(msg);
    expect(existsSync(join(REPO_ROOT, name))).toBe(false);
  });

  it("post --out <thư mục trong repo> → mã 1, không tạo gì", () => {
    const work = mkdtempSync(join(tmpdir(), "cli-paths-"));
    const plan = join(work, "plan.json");
    writeFileSync(plan, "{}");
    const cards = join(work, "cards.json");
    writeFileSync(cards, "[]");
    const name = `out-should-not-exist-${randomBytes(4).toString("hex")}`;
    expect(existsSync(join(REPO_ROOT, name))).toBe(false);
    const r = run("post", "--plan", plan, "--cards", cards, "--out", name);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(msg);
    expect(existsSync(join(REPO_ROOT, name))).toBe(false);
  });
});
