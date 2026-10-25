import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { orientedSize, PhotoError } from "../render/prepare";
import { slug } from "../rulebook/colorway";

export interface IngestedPhoto {
  index: number;
  title: string;
  file: string;
  width: number;
  height: number;
  driveId?: string;
}

export interface IngestFailure {
  input: string;
  reason: string;
}

export interface IngestResult {
  photos: IngestedPhoto[];
  failures: IngestFailure[];
}

const EXT_BY_MIME: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const DRIVE_RESULT_EXT = new Set([".txt", ".json"]);

interface Loaded {
  title: string;
  mimeType?: string;
  driveId?: string;
  data: Buffer;
}

function load(input: string): Loaded {
  if (!existsSync(input)) throw new PhotoError(`Không tìm thấy file: ${input}`);
  if (!DRIVE_RESULT_EXT.has(extname(input).toLowerCase())) return { title: basename(input), data: readFileSync(input) };

  let parsed: { content?: unknown; id?: string; mimeType?: string; title?: string };
  try {
    parsed = JSON.parse(readFileSync(input, "utf8"));
  } catch {
    throw new PhotoError("File không phải JSON hợp lệ (không phải kết quả tải từ Drive).");
  }
  if (typeof parsed.content !== "string") throw new PhotoError("File JSON không có trường content (không phải kết quả tải từ Drive).");
  if (parsed.mimeType && !EXT_BY_MIME[parsed.mimeType]) {
    throw new PhotoError(`Định dạng ${parsed.mimeType} chưa hỗ trợ — cần JPEG, PNG hoặc WebP (ảnh HEIC hãy xuất sang JPEG).`);
  }
  return { title: parsed.title ?? basename(input), mimeType: parsed.mimeType, driveId: parsed.id, data: Buffer.from(parsed.content, "base64") };
}

/** Copies photos into `outDir` as `NN-<slug>.<ext>`, measures them, and writes `photos.json`. Never throws per file. */
export async function ingest(inputs: string[], outDir: string): Promise<IngestResult> {
  mkdirSync(outDir, { recursive: true });
  const photos: IngestedPhoto[] = [];
  const failures: IngestFailure[] = [];

  for (const input of inputs) {
    try {
      const { title, mimeType, driveId, data } = load(input);
      const { width, height } = await orientedSize(data);
      const index = photos.length + 1;
      const ext = (mimeType && EXT_BY_MIME[mimeType]) || extname(title).toLowerCase() || ".jpg";
      const name = `${String(index).padStart(2, "0")}-${slug(title.replace(/\.[^.]+$/, "")) || "anh"}${ext === ".jpeg" ? ".jpg" : ext}`;
      const file = join(outDir, name);
      writeFileSync(file, data);
      photos.push({ index, title, file, width, height, ...(driveId ? { driveId } : {}) });
    } catch (e) {
      failures.push({ input, reason: e instanceof Error ? e.message : String(e) });
    }
  }

  writeFileSync(join(outDir, "photos.json"), JSON.stringify({ photos, failures }, null, 2));
  return { photos, failures };
}
