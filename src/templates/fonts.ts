import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Rulebook } from "../rulebook/types";

export function fontFaceCss(rb: Rulebook, root = process.cwd()): string {
  return Object.values(rb.visual.fonts)
    .map((f) => {
      const data = readFileSync(resolve(root, f.file)).toString("base64");
      return `@font-face{font-family:"${f.family}";src:url(data:font/ttf;base64,${data}) format("truetype");font-weight:${f.weight};font-style:normal;}`;
    })
    .join("\n");
}
