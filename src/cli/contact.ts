import { parseArgs } from "node:util";
import { contactSheet, SheetError } from "../contact/sheet";
import type { IngestedPhoto } from "../ingest/ingest";
import { parseOrUsage, readJson, registerKnownError, runCli, UsageError } from "./run";

registerKnownError(SheetError);

const USAGE = "Cách dùng: npm run contact -- --from <photos.json> --out <bảng.jpg>";

await runCli(USAGE, async () => {
  const { values } = parseOrUsage(() => parseArgs({ options: { from: { type: "string" }, out: { type: "string" } } }));
  if (!values.from || !values.out) throw new UsageError("");
  const manifest = readJson(values.from, (m) => new SheetError(m)) as { photos?: unknown };
  const photos = typeof manifest === "object" && manifest !== null && Array.isArray(manifest.photos) ? (manifest.photos as IngestedPhoto[]) : [];
  if (photos.length === 0) throw new SheetError(`${values.from} không có ảnh nào — chạy npm run ingest trước.`);
  await contactSheet(
    photos.map((p) => ({ file: p.file, label: `${p.index}. ${p.width}×${p.height}` })),
    values.out,
  );
  console.log(`Đã tạo bảng ${photos.length} ảnh: ${values.out}`);
  return 0;
});
