import { readFileSync } from "node:fs";
import { PhotoError } from "../render/prepare";
import { closeBrowser, FontLoadError } from "../render/render";
import { ColorwayError } from "../rulebook/colorway";
import { RulebookError } from "../rulebook/load";

export class UsageError extends Error {}

/** Errors whose message is already a clear Vietnamese explanation for the user. */
const known: Array<new (...args: never[]) => Error> = [PhotoError, RulebookError, FontLoadError, ColorwayError];

export function registerKnownError(cls: new (...args: never[]) => Error): void {
  if (!known.includes(cls)) known.push(cls);
}

/** Turns node:util parseArgs errors into UsageError; `positionalHint` is shown for stray positional arguments. */
export function parseOrUsage<T>(parse: () => T, positionalHint = ""): T {
  try {
    return parse();
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code?.startsWith("ERR_PARSE_ARGS")) {
      throw new UsageError(code === "ERR_PARSE_ARGS_UNEXPECTED_POSITIONAL" ? positionalHint : "");
    }
    throw e;
  }
}

/** Runs a CLI body: prints usage (exit 2), known errors as "Lỗi: …" (exit 1), anything else as unexpected (exit 1). */
export async function runCli(usage: string, main: () => Promise<number>): Promise<void> {
  try {
    process.exitCode = await main();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof UsageError) {
      console.error(usage);
      if (message) console.error(message);
      process.exitCode = 2;
    } else if (known.some((cls) => e instanceof cls)) {
      console.error(`Lỗi: ${message}`);
      process.exitCode = 1;
    } else {
      console.error(`Lỗi không mong đợi: ${message}`);
      process.exitCode = 1;
    }
  } finally {
    await closeBrowser();
  }
}

/** Reads and parses a JSON file; read and parse failures become `fail(message)` (a known error class). */
export function readJson(file: string, fail: (message: string) => Error): unknown {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (e) {
    throw fail(`Không đọc được ${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw fail(`Không đọc được ${file}: JSON không hợp lệ (${e instanceof Error ? e.message : String(e)})`);
  }
}
