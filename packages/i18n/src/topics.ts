import { BASE_TOPICS } from "../catalogs/en/topics";
import { topics } from "../catalogs/ru/topics";

export { BASE_TOPICS };

export const BASE_TOPIC_TRANSLATIONS = Object.entries(topics).map(([slug, text]) => ({
  slug,
  locale: "ru",
  ...text,
}));
