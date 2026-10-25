import { existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export class OutsideRepoError extends Error {}

function findRepoRoot(start: string): string {
  for (let dir = start; ; dir = dirname(dir)) {
    if (existsSync(join(dir, "package.json"))) return dir;
    if (dirname(dir) === dir) throw new Error(`Không tìm thấy package.json phía trên ${start}`);
  }
}

/** This project's root: the nearest folder above this file that holds package.json. */
export const REPO_ROOT = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

/** Absolute path with symlinks resolved for the part that already exists. */
function real(path: string): string {
  const abs = resolve(path);
  if (existsSync(abs)) return realpathSync(abs);
  const parent = dirname(abs);
  return parent === abs ? abs : join(real(parent), basename(abs));
}

const within = (path: string, root: string) => {
  const rel = relative(root, path);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
};

/**
 * Throws OutsideRepoError when `path` resolves inside `repoRoot` (photos and results must not
 * land in the repo). Paths under `tmpRoot` (os.tmpdir()) are always allowed.
 */
export function assertOutsideRepo(path: string, repoRoot: string = REPO_ROOT, tmpRoot: string = tmpdir()): void {
  const p = real(path);
  if (within(p, real(tmpRoot))) return;
  if (within(p, real(repoRoot))) {
    throw new OutsideRepoError(`Thư mục ${path} nằm trong repo — ảnh và kết quả phải ở ngoài repo (ví dụ thư mục scratchpad).`);
  }
}
