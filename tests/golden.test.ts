import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { runF1 } from "../src/pipeline/f1";
import { closeBrowser } from "../src/render/render";
import { makeFlatlayFixture } from "./fixtures/flatlay";
import { compareImages } from "./golden-compare";

afterAll(closeBrowser);

const GOLDEN = join(process.cwd(), "tests/golden");

describe("ảnh chuẩn F1", () => {
  it("layout không lệch so với ảnh chuẩn", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "golden-"));
    const report = await runF1({ photo: await makeFlatlayFixture(), colorway: "easy mint", outDir });
    mkdirSync(GOLDEN, { recursive: true });

    for (const f of report.formats) {
      const name = `f1-easy-mint-${f.format}.png`;
      const golden = join(GOLDEN, name);
      if (process.env.UPDATE_GOLDEN || !existsSync(golden)) {
        writeFileSync(golden, readFileSync(f.file));
        continue;
      }
      const cmp = await compareImages(readFileSync(f.file), readFileSync(golden));
      expect(cmp.same, `${name}: ${cmp.changed} điểm ảnh khác (${(cmp.changedShare * 100).toFixed(3)}%)`).toBe(true);
    }
  });
});
