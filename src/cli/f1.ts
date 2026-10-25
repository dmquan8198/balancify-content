import { parseArgs } from "node:util";
import { runF1 } from "../pipeline/f1";
import { PhotoError } from "../render/prepare";
import { closeBrowser, FontLoadError } from "../render/render";
import { ColorwayError } from "../rulebook/colorway";
import { RulebookError } from "../rulebook/load";

const USAGE = 'Cách dùng: npm run f1 -- --photo <đường dẫn ảnh> --colorway "easy mint" [--out out] [--focus-x 0.5] [--focus-y 0.5]';
const QUOTE_HINT = 'Tên colorway có khoảng trắng — hãy đặt trong ngoặc kép, ví dụ --colorway "easy mint"';

class UsageError extends Error {}

function parse() {
  try {
    const { values } = parseArgs({
      options: {
        photo: { type: "string" },
        colorway: { type: "string" },
        out: { type: "string", default: "out" },
        "focus-x": { type: "string", default: "0.5" },
        "focus-y": { type: "string", default: "0.5" },
      },
    });
    if (!values.photo || !values.colorway) throw new UsageError("");
    return { ...values, photo: values.photo, colorway: values.colorway };
  } catch (e) {
    if (e instanceof UsageError) throw e;
    const code = (e as { code?: string }).code;
    throw new UsageError(code === "ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL" ? QUOTE_HINT : "");
  }
}

/** Issue messages end with "."; drop it before joining so the line has no ".;". */
const joinMessages = (messages: string[]) => messages.map((m) => m.replace(/\.\s*$/, "")).join("; ");

try {
  const args = parse();
  const report = await runF1({
    photo: args.photo,
    colorway: args.colorway,
    outDir: args.out ?? "out",
    focus: { x: Number(args["focus-x"]), y: Number(args["focus-y"]) },
  });
  for (const f of report.formats) {
    const note = f.nameColor === "fallback" ? " (tên colorway đổi sang trắng vì màu túi không đủ tương phản)" : "";
    console.log(`${f.format}: ${f.file} — ${f.checks.length === 0 ? "đạt" : joinMessages(f.checks.map((c) => c.message))}${note}`);
  }
  for (const issue of report.lint) console.log(`chữ: ${issue.message}`);
  console.log(report.ok ? "KẾT QUẢ: ĐẠT" : "KẾT QUẢ: CÓ LỖI");
  process.exitCode = report.ok ? 0 : 1;
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  if (e instanceof UsageError) {
    console.error(USAGE);
    if (message) console.error(message);
    process.exitCode = 2;
  } else if (e instanceof PhotoError || e instanceof RulebookError || e instanceof FontLoadError || e instanceof ColorwayError) {
    console.error(`Lỗi: ${message}`);
    process.exitCode = 1;
  } else {
    console.error(`Lỗi không mong đợi: ${message}`);
    process.exitCode = 1;
  }
} finally {
  await closeBrowser();
}
