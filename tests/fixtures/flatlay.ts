import sharp from "sharp";

/** Deterministic stand-in for a flatlay: dark ground, bag kept left of the colorway-name column, two props above. */
export async function makeFlatlayFixture(accent = "#B8C6B8", ground = "#3B3D3F"): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="3200">
  <rect width="100%" height="100%" fill="${ground}"/>
  <rect x="760" y="1500" width="880" height="1300" rx="220" fill="${accent}"/>
  <path d="M900 1520 Q1200 760 1500 1520" stroke="${accent}" stroke-width="130" fill="none"/>
  <circle cx="1200" cy="2150" r="80" fill="#FFFFFF"/>
  <rect x="700" y="600" width="260" height="380" rx="40" fill="#C2D6EA"/>
  <rect x="1500" y="700" width="300" height="160" rx="30" fill="#8C5E40"/>
</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}
