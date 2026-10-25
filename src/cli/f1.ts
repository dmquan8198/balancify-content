import { parseArgs } from "node:util";
import { runF1 } from "../pipeline/f1";
import { closeBrowser } from "../render/render";

const { values } = parseArgs({
  options: {
    photo: { type: "string" },
    colorway: { type: "string" },
    out: { type: "string", default: "out" },
    "focus-x": { type: "string", default: "0.5" },
    "focus-y": { type: "string", default: "0.5" },
  },
});

if (!values.photo || !values.colorway) {
  console.error('Cách dùng: npm run f1 -- --photo <đường dẫn ảnh> --colorway "easy mint" [--out out] [--focus-x 0.5] [--focus-y 0.5]');
  process.exit(2);
}

try {
  const report = await runF1({
    photo: values.photo,
    colorway: values.colorway,
    outDir: values.out ?? "out",
    focus: { x: Number(values["focus-x"]), y: Number(values["focus-y"]) },
  });
  for (const f of report.formats) {
    const note = f.nameColor === "fallback" ? " (tên colorway đổi sang trắng vì màu túi không đủ tương phản)" : "";
    console.log(`${f.format}: ${f.file} — ${f.checks.length === 0 ? "đạt" : f.checks.map((c) => c.message).join("; ")}${note}`);
  }
  for (const issue of report.lint) console.log(`chữ: ${issue.message}`);
  console.log(report.ok ? "KẾT QUẢ: ĐẠT" : "KẾT QUẢ: CÓ LỖI");
  process.exitCode = report.ok ? 0 : 1;
} finally {
  await closeBrowser();
}
