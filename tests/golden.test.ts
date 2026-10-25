import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { runF1 } from "../src/pipeline/f1";
import { closeBrowser } from "../src/render/render";
import { makeFlatlayFixture } from "./fixtures/flatlay";

afterAll(closeBrowser);

const GOLDEN = join(process.cwd(), "tests/golden");
const MAX_MEAN_DIFF = 0.5; // average per-channel difference, 0–255

async function meanAbsDiff(a: Buffer, b: Buffer): Promise<number> {
  const ra = await sharp(a).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rb = await sharp(b).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (ra.info.width !== rb.info.width || ra.info.height !== rb.info.height) return Infinity;
  let sum = 0;
  for (let i = 0; i < ra.data.length; i++) sum += Math.abs(ra.data[i] - rb.data[i]);
  return sum / ra.data.length;
}

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
      expect(await meanAbsDiff(readFileSync(f.file), readFileSync(golden)), name).toBeLessThan(MAX_MEAN_DIFF);
    }
  });
});
