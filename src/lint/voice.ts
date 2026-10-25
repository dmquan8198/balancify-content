import type { Voice } from "../rulebook/types";

export type Severity = "error" | "warn";

export interface LintIssue {
  rule: "forbidden" | "blocked_claim" | "english" | "hashtag";
  severity: Severity;
  match: string;
  message: string;
  suggestion?: string;
}

const VN_DIACRITIC = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/iu;

// A diacritic-free token counts as Vietnamese if it fits onset + rhyme + coda.
const ONSET = "(?:ngh|ng|nh|ch|gh|gi|kh|ph|qu|th|tr|b|c|d|g|h|k|l|m|n|p|r|s|t|v|x)?";
const NUCLEUS = "(?:uyu|uya|uye|uoi|uou|ieu|yeu|oai|oay|uay|oeo|ai|ao|au|ay|eo|eu|ia|ie|iu|oa|oe|oi|oo|ua|ue|ui|uo|uu|uy|ye|a|e|i|o|u|y)";
const CODA = "(?:ch|ng|nh|c|m|n|p|t)?";
const VN_SYLLABLE = new RegExp(`^${ONSET}${NUCLEUS}${CODA}$`, "i");

const HASHTAG = /#[\p{L}\p{N}_]+/gu;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const phraseRe = (phrase: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(phrase)}(?![\\p{L}\\p{N}])`, "giu");

export function lintText(input: string, voice: Voice): LintIssue[] {
  const text = input.normalize("NFC");
  const issues: LintIssue[] = [];

  for (const word of voice.forbidden) {
    for (const m of text.matchAll(phraseRe(word))) {
      issues.push({ rule: "forbidden", severity: "error", match: m[0], message: `Không dùng "${m[0]}" — luôn xưng "${voice.pronoun}".` });
    }
  }

  for (const claim of voice.blocked_claims) {
    for (const m of text.matchAll(phraseRe(claim))) {
      issues.push({ rule: "blocked_claim", severity: "error", match: m[0], message: `Claim "${m[0]}" không có trong thông tin sản phẩm được phép nói.` });
    }
  }

  const allowedTags = new Set(voice.hashtags_allowed.map((h) => h.toLowerCase()));
  for (const m of text.matchAll(HASHTAG)) {
    if (!allowedTags.has(m[0].toLowerCase())) {
      issues.push({ rule: "hashtag", severity: "warn", match: m[0], message: `Hashtag "${m[0]}" chưa có trong danh sách được phép.` });
    }
  }

  let rest = text.replace(HASHTAG, " ");
  for (const phrase of [...voice.english_allowed.phrases, ...voice.forbidden, ...voice.blocked_claims]) {
    rest = rest.replace(phraseRe(phrase), " ");
  }

  const allowedWords = new Set(voice.english_allowed.words.map((w) => w.toLowerCase()));
  for (const token of rest.match(/\p{L}+/gu) ?? []) {
    if (VN_DIACRITIC.test(token) || allowedWords.has(token.toLowerCase()) || VN_SYLLABLE.test(token)) continue;
    const suggestion = voice.replacements[token.toLowerCase()];
    issues.push({
      rule: "english",
      severity: "error",
      match: token,
      message: suggestion
        ? `Từ tiếng Anh "${token}" — dùng "${suggestion}".`
        : `Từ "${token}" không phải tiếng Việt và không có trong danh sách tiếng Anh được phép.`,
      ...(suggestion ? { suggestion } : {}),
    });
  }

  return issues;
}

export const hasErrors = (issues: LintIssue[]) => issues.some((i) => i.severity === "error");
