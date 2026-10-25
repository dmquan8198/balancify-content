import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertSafeOutDir } from "../src/post/outdir";
import { PlanError } from "../src/post/plan";

// Only temp dirs are passed as outDir here, except os.homedir() which the guard must refuse
// before touching anything. assertSafeOutDir never writes or deletes.
const tmp = () => mkdtempSync(join(tmpdir(), "outdir-"));

describe("assertSafeOutDir", () => {
  it("từ chối khi --out là thư mục hiện tại", () => {
    const cwd = tmp();
    expect(() => assertSafeOutDir(cwd, cwd)).toThrow(PlanError);
    expect(() => assertSafeOutDir(".", cwd)).toThrow(/thư mục hiện tại hoặc thư mục cha/);
  });

  it("từ chối khi --out là thư mục cha của thư mục hiện tại", () => {
    const parent = tmp();
    const cwd = join(parent, "child");
    mkdirSync(cwd);
    expect(() => assertSafeOutDir(parent, cwd)).toThrow(/thư mục hiện tại hoặc thư mục cha/);
    expect(() => assertSafeOutDir("..", cwd)).toThrow(PlanError);
  });

  it("từ chối thư mục có nội dung khác và không đụng vào tệp", () => {
    const cwd = tmp();
    const out = tmp();
    const keep = join(out, "keep.txt");
    writeFileSync(keep, "x");
    expect(() => assertSafeOutDir(out, cwd)).toThrow(/đã có nội dung khác/);
    expect(existsSync(keep)).toBe(true);
  });

  it("từ chối khi --out là một tệp", () => {
    const cwd = tmp();
    const file = join(tmp(), "a.txt");
    writeFileSync(file, "x");
    expect(() => assertSafeOutDir(file, cwd)).toThrow(PlanError);
    expect(existsSync(file)).toBe(true);
  });

  it("chấp nhận thư mục chưa có", () => {
    expect(() => assertSafeOutDir(join(tmp(), "new"), tmp())).not.toThrow();
  });

  it("chấp nhận thư mục rỗng", () => {
    expect(() => assertSafeOutDir(tmp(), tmp())).not.toThrow();
  });

  it("chấp nhận gói duyệt cũ có .post-pack", () => {
    const out = tmp();
    writeFileSync(join(out, ".post-pack"), "x");
    writeFileSync(join(out, "review.md"), "x");
    mkdirSync(join(out, "slide-1"));
    expect(() => assertSafeOutDir(out, tmp())).not.toThrow();
  });

  it("từ chối thư mục người dùng và thư mục gốc", () => {
    expect(() => assertSafeOutDir(homedir(), tmp())).toThrow(PlanError);
    expect(() => assertSafeOutDir("/", tmp())).toThrow(PlanError);
  });
});
