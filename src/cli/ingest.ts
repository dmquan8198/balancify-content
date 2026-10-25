import { parseArgs } from "node:util";
import { ingest } from "../ingest/ingest";
import { parseOrUsage, runCli, UsageError } from "./run";

const USAGE = "Cách dùng: npm run ingest -- --out <thư mục ảnh> <file ảnh hoặc file tải từ Drive>...";

await runCli(USAGE, async () => {
  const { values, positionals } = parseOrUsage(() => parseArgs({ options: { out: { type: "string" } }, allowPositionals: true }));
  if (!values.out || positionals.length === 0) throw new UsageError("");
  const r = await ingest(positionals, values.out);
  console.log(`Đã nạp ${r.photos.length} ảnh vào ${values.out}`);
  for (const p of r.photos) console.log(`${p.index}. ${p.title} → ${p.file} (${p.width}×${p.height})`);
  for (const f of r.failures) console.log(`Bỏ qua ${f.input}: ${f.reason}`);
  return r.photos.length > 0 ? 0 : 1;
});
