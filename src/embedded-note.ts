import { maxEmbeddedNoteCharacters, supportedStyles, type PolishQuality, type PolishStyle } from "./polish-options.js";

const embeddedNotePattern = /^(?<text>[\s\S]*?)(?:\r?\n[ \t]*)+(?<noteBlock>[ \t]*(?:note\s*:|备注\s*[:：])[\s\S]*)$/i;

// Only a final line or paragraph that starts with note/备注 is treated as instruction text.
// This keeps normal sentences that mention "note" or "备注" inside the content.
const stylePatterns: Record<PolishStyle, readonly RegExp[]> = {
  natural: [/\bnatural\b/i, /自然/],
  professional: [/\bprofessional\b/i, /专业/],
  concise: [/\bconcise\b/i, /\bshort(?:er)?\b/i, /\bbrief\b/i, /简短|精简|简洁|短一点|短些|更短/],
};

const supportedQualities = ["cheap", "balanced", "quality"] as const satisfies readonly PolishQuality[];

const qualityPatterns: Record<PolishQuality, readonly RegExp[]> = {
  cheap: [
    /\bcheap\b/i,
    /\blow\s*cost\b/i,
    /\bfast\b/i,
    /\bsuperfast\b/i,
    /\bultra\s*fast\b/i,
    /便宜|低成本|省钱|最便宜|最快|极速|超快|快速|快一点/,
  ],
  balanced: [/\bbalanced?\b/i, /平衡|默认/],
  quality: [/\bquality\b/i, /\bbest\b/i, /\bhigh quality\b/i, /高质量|质量高|更好/],
};

export type EmbeddedNoteResult = {
  text: string;
  note?: string;
  noteStyle?: PolishStyle;
  noteQuality?: PolishQuality;
  noteTooLong?: boolean;
};

export function extractEmbeddedNote(rawText: string): EmbeddedNoteResult {
  const match = embeddedNotePattern.exec(rawText);

  if (!match?.groups) {
    return { text: rawText };
  }

  const text = match.groups.text;
  const noteBlock = match.groups.noteBlock;

  if (!noteBlock) {
    return { text: rawText };
  }

  const note = noteBlock.replace(/^[ \t]*(?:note\s*:|备注\s*[:：])\s*/i, "").trim();

  if (!note) {
    return { text: rawText };
  }

  if (note.length > maxEmbeddedNoteCharacters) {
    return {
      text: text.trimEnd(),
      note,
      noteTooLong: true,
    };
  }

  return {
    text: text.trimEnd(),
    note,
    noteStyle: resolveStyleFromNote(note),
    noteQuality: resolveQualityFromNote(note),
  };
}

function resolveStyleFromNote(note: string) {
  // Override structured fields only when the note maps to exactly one option.
  // The full note is still passed to the model even when no keyword matches.
  const matches = supportedStyles.filter((style) => hasPatternMatch(note, stylePatterns[style]));
  return matches.length === 1 ? matches[0] : undefined;
}

function resolveQualityFromNote(note: string) {
  const matches = supportedQualities.filter((quality) => hasPatternMatch(note, qualityPatterns[quality]));
  return matches.length === 1 ? matches[0] : undefined;
}

function hasPatternMatch(value: string, patterns: readonly RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}
