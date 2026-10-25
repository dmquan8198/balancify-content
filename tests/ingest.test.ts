import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ingest } from "../src/ingest/ingest";

describe("ingest", () => {
  it("nạp file tải từ Drive và ảnh cục bộ, liệt kê file lỗi kèm lý do", async () => {
    const src = mkdtempSync(join(tmpdir(), "ingest-src-"));
    const out = join(mkdtempSync(join(tmpdir(), "ingest-out-")), "photos");
    const jpg = await sharp({ create: { width: 2000, height: 3000, channels: 3, background: "#888" } }).jpeg().toBuffer();

    const drive = join(src, "mcp-Google_Drive-download_file_content-1.txt");
    writeFileSync(drive, JSON.stringify({ content: jpg.toString("base64"), id: "abc", mimeType: "image/jpeg", title: "IMG_8316.jpeg" }));
    const local = join(src, "Ảnh đẹp.jpg");
    writeFileSync(local, jpg);
    const heic = join(src, "heic.txt");
    writeFileSync(heic, JSON.stringify({ content: "AAAA", id: "h", mimeType: "image/heic", title: "IMG_1.HEIC" }));
    const garbage = join(src, "rac.txt");
    writeFileSync(garbage, "không phải json");

    const r = await ingest([drive, local, heic, garbage, join(src, "khong-co.jpg")], out);

    expect(r.photos.map((p) => [p.index, p.title, p.width, p.height, p.driveId])).toEqual([
      [1, "IMG_8316.jpeg", 2000, 3000, "abc"],
      [2, "Ảnh đẹp.jpg", 2000, 3000, undefined],
    ]);
    expect(r.photos[0].file).toBe(join(out, "01-img-8316.jpg"));
    expect(r.photos[1].file).toBe(join(out, "02-anh-dep.jpg"));
    for (const p of r.photos) expect(existsSync(p.file)).toBe(true);

    expect(r.failures.map((f) => f.input)).toEqual([heic, garbage, join(src, "khong-co.jpg")]);
    expect(r.failures[0].reason).toContain("image/heic");
    expect(r.failures[1].reason).toContain("JSON");
    expect(r.failures[2].reason).toContain("Không tìm thấy");

    const manifest = JSON.parse(readFileSync(join(out, "photos.json"), "utf8"));
    expect(manifest.photos).toHaveLength(2);
    expect(manifest.failures).toHaveLength(3);
  });
});
