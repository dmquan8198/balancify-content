import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { photoInfo, PhotoError } from "../render/prepare";
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
  /** Photos added by this run (`photos.json` also keeps earlier runs' photos). */
  photos: IngestedPhoto[];
  /** Inputs that could not be ingested in this run. */
  failures: IngestFailure[];
  /** Inputs already ingested earlier (this run or before) and left untouched. */
  skipped: IngestFailure[];
}

const EXT_BY_MIME: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const EXT_BY_FORMAT: Record<string, string> = { jpeg: ".jpg", png: ".png", webp: ".webp" };

const unsupported = (what: string) => new PhotoError(`Định dạng ${what} chưa hỗ trợ — cần JPEG, PNG hoặc WebP (ảnh HEIC hãy xuất sang JPEG).`);
const DRIVE_RESULT_EXT = new Set([".txt", ".json"]);

interface Loaded {
  title: string;
  mimeType?: string;
  driveId?: string;
  data: Buffer;
}

function load(input: string): Loaded {
  if (!existsSync(input)) throw new PhotoError(`Không tìm thấy file: ${input}`);
  if (!statSync(input).isFile()) throw new PhotoError(`Không phải file: ${input}`);
  if (!DRIVE_RESULT_EXT.has(extname(input).toLowerCase())) return { title: basename(input), data: readFileSync(input) };

  let parsed: { content?: unknown; id?: string; mimeType?: string; title?: string };
  try {
    parsed = JSON.parse(readFileSync(input, "utf8"));
  } catch {
    throw new PhotoError("File không phải JSON hợp lệ (không phải kết quả tải từ Drive).");
  }
  if (typeof parsed.content !== "string") throw new PhotoError("File JSON không có trường content (không phải kết quả tải từ Drive).");
  if (parsed.mimeType && !EXT_BY_MIME[parsed.mimeType]) {
    throw unsupported(parsed.mimeType);
  }
  return { title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title : basename(input), mimeType: parsed.mimeType, driveId: parsed.id, data: Buffer.from(parsed.content, "base64") };
}

function readManifest(outDir: string): IngestedPhoto[] {
  const path = join(outDir, "photos.json");
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(parsed.photos) ? parsed.photos : [];
  } catch {
    throw new PhotoError(`Không đọc được ${path}; hãy xoá file này hoặc dùng thư mục khác.`);
  }
}

function sizeOf(file: string): number | undefined {
  try {
    return statSync(file).size;
  } catch {
    return undefined;
  }
}

/**
 * Copies photos into `outDir` as `NN-<slug>.<ext>`, measures them, and writes `photos.json`.
 * Append-only: numbering continues from the highest existing index and photos already ingested are skipped.
 * Never throws per file.
 */
export async function ingest(inputs: string[], outDir: string): Promise<IngestResult> {
  mkdirSync(outDir, { recursive: true });
  const existing = readManifest(outDir);
  const photos: IngestedPhoto[] = [];
  const failures: IngestFailure[] = [];
  const skipped: IngestFailure[] = [];
  let next = existing.reduce((max, p) => Math.max(max, p.index), 0) + 1;

  for (const input of inputs) {
    try {
      const { title, driveId, data } = load(input);
      const dup = [...existing, ...photos].find((p) => (driveId ? p.driveId === driveId : !p.driveId && p.title === title && sizeOf(p.file) === data.length));
      if (dup) {
        skipped.push({ input, reason: `Đã nạp trước đó (${dup.file})` });
        continue;
      }
      const { width, height, format } = await photoInfo(data);
      const ext = EXT_BY_FORMAT[format];
      if (!ext) throw unsupported(format);
      const index = next;
      const name = `${String(index).padStart(2, "0")}-${slug(basename(title, extname(title))) || "anh"}${ext}`;
      const file = join(outDir, name);
      writeFileSync(file, data);
      photos.push({ index, title, file, width, height, ...(driveId ? { driveId } : {}) });
      next += 1;
    } catch (e) {
      failures.push({ input, reason: e instanceof Error ? e.message : String(e) });
    }
  }

  writeFileSync(join(outDir, "photos.json"), JSON.stringify({ photos: [...existing, ...photos], failures }, null, 2));
  return { photos, failures, skipped };
}
