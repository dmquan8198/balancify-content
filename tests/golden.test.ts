import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { runF1 } from "../src/pipeline/f1";
import { closeBrowser } from "../src/render/render";
import { makeFlatlayFixture } from "./fixtures/flatlay";
import { checkGolden } from "./golden-compare";

afterAll(closeBrowser);

const GOLDEN = join(process.cwd(), "tests/golden");

describe("ảnh chuẩn F1", () => {
  it("layout không lệch so với ảnh chuẩn", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "golden-"));
    const report = await runF1({ photo: await makeFlatlayFixture(), colorway: "easy mint", outDir });
    for (const f of report.formats) {
      const r = await checkGolden(readFileSync(f.file), join(GOLDEN, `f1-easy-mint-${f.format}.png`), Boolean(process.env.UPDATE_GOLDEN));
      expect(r.ok, r.message).toBe(true);
    }
  });
});
