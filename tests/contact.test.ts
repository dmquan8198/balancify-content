import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { contactSheet } from "../src/contact/sheet";

describe("contactSheet", () => {
  it("xếp lưới 4 cột, mỗi ô 360px + dải nhãn 40px", async () => {
    const dir = mkdtempSync(join(tmpdir(), "contact-"));
    const items = await Promise.all(
      [1, 2, 3, 4, 5].map(async (i) => {
        const file = join(dir, `${i}.jpg`);
        writeFileSync(file, await sharp({ create: { width: 1200, height: 1600, channels: 3, background: "#777" } }).jpeg().toBuffer());
        return { file, label: String(i) };
      }),
    );
    const out = join(dir, "sheet.jpg");
    await contactSheet(items, out);
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height]).toEqual([1440, 800]);
  });

  it("danh sách rỗng → lỗi", async () => {
    await expect(contactSheet([], "/tmp/x.jpg")).rejects.toThrow(/rỗng/);
  });
});
