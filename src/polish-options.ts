export const supportedStyles = ["natural", "professional", "concise"] as const;

// Quality names are cost/quality tiers; they are not strict latency guarantees.
export const qualityToModel = {
  cheap: "gpt-5.4-nano",
  balanced: "gpt-5.4-mini",
  quality: "gpt-5.4",
} as const;

export const maxTextCharacters = 8_000;
export const maxEmbeddedNoteCharacters = 1_000;
export const openaiTimeoutMs = 8_000;
export const polishCacheTtlMs = 60_000;
export const maxPolishCacheEntries = 300;

export type PolishStyle = (typeof supportedStyles)[number];
export type PolishQuality = keyof typeof qualityToModel;
export type PolishModel = (typeof qualityToModel)[PolishQuality];

export const qualityModelFallbacks = {
  cheap: [qualityToModel.cheap],
  balanced: [qualityToModel.balanced, qualityToModel.cheap],
  quality: [qualityToModel.quality, qualityToModel.balanced, qualityToModel.cheap],
} as const satisfies Record<PolishQuality, readonly PolishModel[]>;

export const styleGuidance: Record<PolishStyle, string> = {
  natural: "Make the text clear, natural, friendly, and concise without changing the tone more than necessary.",
  professional: "Make the text more professional and work-appropriate while keeping it clear and practical.",
  concise: "Make the text shorter while preserving the original meaning and important details.",
};
