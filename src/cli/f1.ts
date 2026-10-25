import { parseArgs } from "node:util";
import { runF1 } from "../pipeline/f1";
import { parseOrUsage, runCli, UsageError } from "./run";

const USAGE = 'Cách dùng: npm run f1 -- --photo <đường dẫn ảnh> --colorway "easy mint" [--out out] [--focus-x 0.5] [--focus-y 0.5]';
const QUOTE_HINT = 'Tên colorway có khoảng trắng — hãy đặt trong ngoặc kép, ví dụ --colorway "easy mint"';

/** Issue messages end with "."; drop it before joining so the line has no ".;". */
const joinMessages = (messages: string[]) => messages.map((m) => m.replace(/\.\s*$/, "")).join("; ");

await runCli(USAGE, async () => {
  const { values } = parseOrUsage(
    () =>
      parseArgs({
        options: {
          photo: { type: "string" },
          colorway: { type: "string" },
          out: { type: "string", default: "out" },
          "focus-x": { type: "string", default: "0.5" },
          "focus-y": { type: "string", default: "0.5" },
        },
      }),
    QUOTE_HINT,
  );
  if (!values.photo || !values.colorway) throw new UsageError("");
  const report = await runF1({
    photo: values.photo,
    colorway: values.colorway,
    outDir: values.out ?? "out",
    focus: { x: Number(values["focus-x"]), y: Number(values["focus-y"]) },
  });
  for (const f of report.formats) {
    const note = f.nameColor === "fallback" ? " (tên colorway đổi sang trắng vì màu túi không đủ tương phản)" : "";
    console.log(`${f.format}: ${f.file} — ${f.checks.length === 0 ? "đạt" : joinMessages(f.checks.map((c) => c.message))}${note}`);
  }
  for (const issue of report.lint) console.log(`chữ: ${issue.message}`);
  console.log(report.ok ? "KẾT QUẢ: ĐẠT" : "KẾT QUẢ: CÓ LỖI");
  return report.ok ? 0 : 1;
});
