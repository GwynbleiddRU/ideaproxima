import { writeFileSync } from "node:fs";
import { productVocabulary } from "@ideaproxima/domain";
import { extractVocabulary } from "../../packages/i18n/src/vocabulary";

const destination = new URL("../../packages/i18n/catalogs/en/vocabulary.json", import.meta.url);
writeFileSync(destination, JSON.stringify(extractVocabulary(productVocabulary()), null, 2) + "\n");
