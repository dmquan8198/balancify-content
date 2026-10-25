export interface Brand {
  name: string;
  product: string;
  positioning: string;
  message: string;
  tagline: { text: string; placement: string };
  audience: string;
  jobs: { functional: string; emotional: string; social: string };
  product_facts: string[];
}

export interface Voice {
  pronoun: string;
  forbidden: string[];
  english_allowed: { phrases: string[]; words: string[] };
  hashtags_allowed: string[];
  replacements: Record<string, string>;
  blocked_claims: string[];
  examples: string[];
}

export interface FontSpec {
  family: string;
  weight: number | string;
  file: string;
  provisional?: boolean;
}

export interface Colorway {
  accent: string;
  provisional?: boolean;
}

export interface Format {
  width: number;
  height: number;
  safe_top?: number;
  safe_bottom?: number;
}

export interface Visual {
  neutrals: Record<string, string>;
  colorways: Record<string, Colorway>;
  fonts: Record<"display" | "body" | "body_semibold" | "handwriting", FontSpec>;
  banned_elements: string[];
  formats: { feed: Format; story: Format };
  contrast: { min_small: number; min_large: number; large_px: number };
}

export type Goal = "B" | "C" | "D";

export interface Pillar {
  share: number | null;
  goals: Goal[];
  family: "F1" | "F2" | "F3" | "F4";
  photo: "flatlay" | "lifestyle" | "any";
}

export interface Rulebook {
  brand: Brand;
  voice: Voice;
  visual: Visual;
  pillars: Record<string, Pillar>;
}
