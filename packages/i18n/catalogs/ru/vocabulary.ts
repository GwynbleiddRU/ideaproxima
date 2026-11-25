import type en from "../en/vocabulary.json";

export const vocabulary = {
  "stages.imagined.label": "Замысел",
} satisfies Partial<Record<keyof typeof en, string>>;
