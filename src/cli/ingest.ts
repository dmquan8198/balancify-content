import { parseArgs } from "node:util";
import { ingest } from "../ingest/ingest";
import { assertOutsideRepo, OutsideRepoError } from "./paths";
import { parseOrUsage, registerKnownError, runCli, UsageError } from "./run";

registerKnownError(OutsideRepoError);

const USAGE = "Cách dùng: npm run ingest -- --out <thư mục ảnh> <file ảnh hoặc file tải từ Drive>...";

await runCli(USAGE, async () => {
  const { values, positionals } = parseOrUsage(() => parseArgs({ options: { out: { type: "string" } }, allowPositionals: true }));
  if (!values.out || positionals.length === 0) throw new UsageError("");
  assertOutsideRepo(values.out);
  const r = await ingest(positionals, values.out);
  console.log(`Đã nạp ${r.photos.length} ảnh vào ${values.out}`);
  for (const p of r.photos) console.log(`${p.index}. ${p.title} → ${p.file} (${p.width}×${p.height})`);
  for (const s of r.skipped) console.log(`Đã có sẵn: ${s.input} — ${s.reason}`);
  for (const f of r.failures) console.log(`Bỏ qua ${f.input}: ${f.reason}`);
  if (r.failures.length > 0) console.log(`Bỏ qua ${r.failures.length} file.`);
  return r.photos.length + r.skipped.length > 0 ? 0 : 1;
});
