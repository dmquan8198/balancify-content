import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { contactSheet, SheetError } from "../contact/sheet";
import type { IngestResult } from "../ingest/ingest";
import { parseOrUsage, registerKnownError, runCli, UsageError } from "./run";

registerKnownError(SheetError);

const USAGE = "Cách dùng: npm run contact -- --from <photos.json> --out <bảng.jpg>";

await runCli(USAGE, async () => {
  const { values } = parseOrUsage(() => parseArgs({ options: { from: { type: "string" }, out: { type: "string" } } }));
  if (!values.from || !values.out) throw new UsageError("");
  const manifest = JSON.parse(readFileSync(values.from, "utf8")) as IngestResult;
  await contactSheet(
    manifest.photos.map((p) => ({ file: p.file, label: `${p.index}. ${p.width}×${p.height}` })),
    values.out,
  );
  console.log(`Đã tạo bảng ${manifest.photos.length} ảnh: ${values.out}`);
  return 0;
});
