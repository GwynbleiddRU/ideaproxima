import type { BASE_TOPICS } from "../en/topics";

export const topics = {
  energy: { name: "Энергетика", description: "Доступная, чистая энергия для всех." },
} satisfies Partial<Record<(typeof BASE_TOPICS)[number]["slug"], { name: string; description: string }>>;
