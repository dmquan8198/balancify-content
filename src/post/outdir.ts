import { readdirSync, realpathSync, statSync, type Stats } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { PlanError } from "./plan";

/** File runPost writes into every review pack; only folders carrying it may be replaced. */
export const POST_PACK_MARKER = ".post-pack";
export const POST_PACK_NOTE = "Thư mục này do npm run post tạo; có thể bị thay thế ở lần chạy sau.\n";

const real = (p: string) => {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
};

/** True when `a` is `b` or one of its ancestors. */
const isSameOrAncestor = (a: string, b: string) => {
  const rel = relative(a, b);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
};

/**
 * Throws PlanError unless `outDir` is safe for runPost to replace: it must not exist, be empty,
 * or be a previous review pack (contains POST_PACK_MARKER). Never the cwd or an ancestor of it,
 * the filesystem root, or the home folder. Only stats and lists — never writes or deletes.
 */
export function assertSafeOutDir(outDir: string, cwd: string): void {
  const out = resolve(cwd, outDir);
  const candidates = [out, real(out)];
  const cwds = [resolve(cwd), real(resolve(cwd))];
  const home = resolve(homedir());
  const homes = [home, real(home)];

  for (const o of candidates) {
    if (cwds.some((c) => isSameOrAncestor(o, c))) {
      throw new PlanError(`Thư mục --out không được là thư mục hiện tại hoặc thư mục cha của nó: ${out}`);
    }
    if (dirname(o) === o) throw new PlanError(`Thư mục --out không được là thư mục gốc: ${out}`);
    if (homes.some((h) => isSameOrAncestor(o, h))) {
      throw new PlanError(`Thư mục --out không được là thư mục người dùng hoặc thư mục cha của nó: ${out}`);
    }
  }

  let st: Stats;
  try {
    st = statSync(out);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
    throw new PlanError(`Không kiểm tra được thư mục --out ${out}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!st.isDirectory()) throw new PlanError(`--out phải là thư mục, nhưng ${out} là tệp.`);
  const entries = readdirSync(out);
  if (entries.length === 0 || entries.includes(POST_PACK_MARKER)) return;
  throw new PlanError(`Thư mục --out đã có nội dung khác (${out}) — hãy chọn thư mục mới hoặc thư mục gói duyệt cũ.`);
}
