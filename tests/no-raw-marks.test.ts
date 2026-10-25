import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? tsFiles(p) : p.endsWith(".ts") ? [p] : [];
  });
}

describe("mã nguồn", () => {
  it("không chứa ký tự dấu kết hợp (U+0300–U+036F) viết trần", () => {
    const offenders = tsFiles(join(process.cwd(), "src")).filter((f) => /[̀-ͯ]/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
