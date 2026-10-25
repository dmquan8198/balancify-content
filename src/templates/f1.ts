import { findColorway } from "../rulebook/colorway";
import type { Rulebook } from "../rulebook/types";
import { fontFaceCss } from "./fonts";

export type FormatName = "feed" | "story";

export interface F1Input {
  photoJpeg: Buffer;
  colorway: string;
  format: FormatName;
  label?: string;
  /** Hex colour for the colorway name; defaults to the colorway accent. */
  nameColor?: string;
}

export interface TemplateOutput {
  html: string;
  width: number;
  height: number;
  fonts: string[];
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function f1Html(rb: Rulebook, input: F1Input): TemplateOutput {
  const fmt = rb.visual.formats[input.format];
  const { name, colorway } = findColorway(rb.visual, input.colorway);
  const hand = rb.visual.fonts.handwriting;
  const label = rb.visual.fonts.body_semibold;
  const nameTop = Math.round(fmt.height * 0.62);
  // Story: top-left, just under the top safe zone. Feed: bottom-left.
  const labelPos = input.format === "story" ? `top:${(fmt.safe_top ?? 0) + 40}px` : `bottom:${(fmt.safe_bottom ?? 0) + 56}px`;
  const photo = `data:image/jpeg;base64,${input.photoJpeg.toString("base64")}`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFaceCss(rb)}
html,body{margin:0;padding:0}
body{width:${fmt.width}px;height:${fmt.height}px;position:relative;overflow:hidden;background:${rb.visual.neutrals.ground}}
.photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.name{position:absolute;left:${fmt.width - 150}px;top:${nameTop}px;transform:translate(-50%,-50%) rotate(72deg);white-space:nowrap;font-family:"${hand.family}";font-weight:${hand.weight};font-size:64px;line-height:1;color:${input.nameColor ?? colorway.accent}}
.label{position:absolute;left:56px;${labelPos};font-family:"${label.family}";font-weight:${label.weight};font-size:26px;letter-spacing:.08em;line-height:1.3;color:${rb.visual.neutrals.white}}
</style></head><body>
<img class="photo" src="${photo}" alt="">
<div class="name" data-text="colorway-name">${escapeHtml(name)}</div>
<div class="label" data-text="label">${escapeHtml(input.label ?? rb.brand.product)}</div>
</body></html>`;

  return { html, width: fmt.width, height: fmt.height, fonts: [hand.family, label.family] };
}
