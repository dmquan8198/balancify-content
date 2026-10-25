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

  it("nạp thêm vào thư mục cũ: tiếp số thứ tự, bỏ qua file đã nạp", async () => {
    const src = mkdtempSync(join(tmpdir(), "ingest-src-"));
    const out = join(mkdtempSync(join(tmpdir(), "ingest-out-")), "photos");
    const jpg = await sharp({ create: { width: 1500, height: 2000, channels: 3, background: "#888" } }).jpeg().toBuffer();
    const jpg2 = await sharp({ create: { width: 1600, height: 2000, channels: 3, background: "#444" } }).jpeg().toBuffer();
    const a = join(src, "a.jpg");
    const b = join(src, "b.jpg");
    writeFileSync(a, jpg);
    writeFileSync(b, jpg2);

    const first = await ingest([a], out);
    expect(first.photos.map((p) => p.index)).toEqual([1]);
    const firstFile = first.photos[0].file;
    const before = readFileSync(firstFile);

    const second = await ingest([a, b], out);
    expect(second.photos.map((p) => [p.index, p.title])).toEqual([[2, "b.jpg"]]);
    expect(second.skipped).toHaveLength(1);
    expect(second.skipped[0].input).toBe(a);
    expect(second.skipped[0].reason).toContain("Đã nạp trước đó");
    expect(second.skipped[0].reason).toContain(firstFile);
    expect(readFileSync(firstFile).equals(before)).toBe(true);

    const manifest = JSON.parse(readFileSync(join(out, "photos.json"), "utf8"));
    expect(manifest.photos.map((p: { index: number }) => p.index)).toEqual([1, 2]);
  });

  it("cùng driveId hai lần trong một lần chạy: lần sau bị bỏ qua", async () => {
    const src = mkdtempSync(join(tmpdir(), "ingest-src-"));
    const out = join(mkdtempSync(join(tmpdir(), "ingest-out-")), "photos");
    const jpg = await sharp({ create: { width: 1500, height: 2000, channels: 3, background: "#888" } }).jpeg().toBuffer();
    const one = join(src, "one.txt");
    const two = join(src, "two.txt");
    const body = JSON.stringify({ content: jpg.toString("base64"), id: "same", mimeType: "image/jpeg", title: "x.jpg" });
    writeFileSync(one, body);
    writeFileSync(two, body);
    const r = await ingest([one, two], out);
    expect(r.photos).toHaveLength(1);
    expect(r.skipped.map((s) => s.input)).toEqual([two]);
  });

  it("chỉ nhận JPEG/PNG/WebP theo nội dung thật; đuôi file theo định dạng phát hiện", async () => {
    const src = mkdtempSync(join(tmpdir(), "ingest-src-"));
    const out = join(mkdtempSync(join(tmpdir(), "ingest-out-")), "photos");
    const base = { create: { width: 1200, height: 1600, channels: 3 as const, background: "#888" } };
    const gif = join(src, "a.gif");
    writeFileSync(gif, await sharp(base).gif().toBuffer());
    const svg = join(src, "b.svg");
    writeFileSync(svg, '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600"><rect width="1200" height="1600" fill="red"/></svg>');
    const png = await sharp(base).png().toBuffer();
    const drive = join(src, "d.txt");
    writeFileSync(drive, JSON.stringify({ content: png.toString("base64"), id: "p1", mimeType: "image/jpeg", title: "tho.jpeg" }));

    const r = await ingest([gif, svg, drive], out);
    expect(r.failures.map((f) => f.input)).toEqual([gif, svg]);
    expect(r.failures[0].reason).toContain("gif");
    expect(r.failures[0].reason).toContain("JPEG, PNG hoặc WebP");
    expect(r.failures[1].reason).toContain("svg");
    expect(r.photos).toHaveLength(1);
    expect(r.photos[0].file).toBe(join(out, "01-tho.png"));
  });
});
