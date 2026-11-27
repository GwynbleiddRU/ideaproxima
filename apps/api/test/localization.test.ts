import { afterAll, beforeAll, expect, it } from "vitest";
import type {
  ActivityDto,
  Page,
  AuthResponse,
  ErrorResponse,
  LocaleDto,
  MeResponse,
  TopicDetailDto,
  VocabularyResponse,
} from "@ideaproxima/contracts";
import { ensureBaseTopics } from "../src/db/reference-data";
import { createHarness, type Harness } from "./harness";

let h: Harness;

beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());

const russian = { "accept-language": "ru-RU, en;q=0.5" };
const english = { "accept-language": "en-US" };
const vocabulary = "/vocabulary";

it("lists the twelve beta locales and negotiates explicit, anonymous and default requests", async () => {
  const list = await h.call<LocaleDto[]>("GET", "/locales");
  expect(list.body.map(({ tag }) => tag)).toEqual([
    "en",
    "zh-Hans",
    "es",
    "ar",
    "pt-BR",
    "id",
    "fr",
    "ja",
    "ru",
    "de",
    "hi",
    "ko",
  ]);
  expect(list.body).toContainEqual({ tag: "ar", name: "العربية", direction: "rtl", status: "beta" });
  expect(list.body.every(({ status }) => status === "beta")).toBe(true);

  const [ru, en, alias, fallback] = await Promise.all([
    h.call<VocabularyResponse>("GET", vocabulary, { headers: russian }),
    h.call<VocabularyResponse>("GET", vocabulary),
    h.call<VocabularyResponse>("GET", vocabulary + "?locale=zh-TW", { headers: russian }),
    h.call<VocabularyResponse>("GET", vocabulary + "?locale=zz-ZZ", { headers: russian }),
  ]);
  expect([ru.body.locale, en.body.locale, alias.body.locale, fallback.body.locale]).toEqual([
    "ru",
    "en",
    "zh-Hans",
    "ru",
  ]);
  expect(ru.headers.get("content-language")).toBe("ru");
  expect(en.headers.get("content-language")).toBe("en");
  expect(ru.body.stages[0]).toMatchObject({ key: "imagined", label: "Замысел" });
  expect(en.body.stages[0]).toMatchObject({ key: "imagined", label: "Imagined" });
  expect(ru.body.stages[0]!.description).toBe(en.body.stages[0]!.description);
});

it("persists, overrides and clears account preferences without changing the public profile", async () => {
  const created = await h.call<AuthResponse>("POST", "/auth/register", {
    body: {
      handle: "language-test",
      confirmAge: true,
      displayName: "Language Test",
      email: "locale@example.test",
      password: "localisation fixture",
      locale: "ru",
    },
  });
  expect(created.body.preferences.locale).toBe("ru");
  const token = created.body.token;
  const me = await h.call<MeResponse>("GET", "/me", { token });
  expect(me.body.preferences.locale).toBe("ru");
  expect(me.headers.get("cache-control")).toBe("private, no-store");

  const saved = await h.call<VocabularyResponse>("GET", vocabulary, { token, headers: english });
  const cookie = await h.call<VocabularyResponse>("GET", vocabulary, {
    headers: { ...english, cookie: `ip_session=${token}` },
  });
  const explicit = await h.call<VocabularyResponse>("GET", vocabulary + "?locale=en", {
    token,
    headers: russian,
  });
  expect([saved.body.locale, cookie.body.locale, explicit.body.locale]).toEqual(["ru", "ru", "en"]);
  for (const result of [saved, cookie, explicit])
    expect(result.headers.get("cache-control")).toBe("private, no-store");

  const invalid = await h.call<ErrorResponse>("PATCH", "/me", {
    token,
    body: { locale: "zz", displayName: "Rejected" },
  });
  expect(invalid.status).toBe(400);
  expect(invalid.body.error.details.reason).toBe("unsupported_locale");
  expect((await h.call<MeResponse>("GET", "/me", { token })).body).toEqual(me.body);

  const savedNew = await h.call("PATCH", "/me", { token, body: { locale: "de", displayName: "Updated" } });
  expect(savedNew.body).toMatchObject({ displayName: "Updated" });
  expect(savedNew.body).not.toHaveProperty("locale");
  expect((await h.call<MeResponse>("GET", "/me", { token })).body.preferences.locale).toBe("de");

  await h.call("PATCH", "/me", { token, body: { locale: null } });
  expect((await h.call<MeResponse>("GET", "/me", { token })).body.preferences.locale).toBeNull();
  expect((await h.call<VocabularyResponse>("GET", vocabulary, { token, headers: russian })).body.locale).toBe(
    "ru",
  );
});

it.each([
  [english, russian, {}],
  [russian, english, {}],
  [{}, russian, english],
])(
  "keeps both anonymous locales and a missing header separate in a shared cache",
  async (...variants: Record<string, string>[]) => {
    type Result = Awaited<ReturnType<typeof h.call<VocabularyResponse>>>;
    const cache: { response: Result; request: Headers; vary: string[] }[] = [];
    let misses = 0;
    async function cached(headers: Record<string, string>) {
      const request = new Headers(headers);
      const entry = cache.find(({ request: prior, vary }) =>
        vary.every((name) => prior.get(name) === request.get(name)),
      );
      if (entry) return entry.response;
      misses++;
      const response = await h.call<VocabularyResponse>("GET", vocabulary, { headers });
      const vary =
        response.headers
          .get("vary")
          ?.toLowerCase()
          .split(",")
          .map((part) => part.trim()) ?? [];
      expect(vary).toEqual(expect.arrayContaining(["accept-language", "cookie", "authorization"]));
      if (!response.headers.get("cache-control")?.includes("no-store"))
        cache.push({ response, request, vary });
      return response;
    }

    for (const headers of variants) {
      if (headers["accept-language"]?.startsWith("ru"))
        expect((await cached(headers)).body.locale).toBe("ru");
      else expect((await cached(headers)).body.locale).toBe("en");
    }
    expect(misses).toBe(3);
    for (const headers of [...variants].reverse()) await cached(headers);
    expect(misses).toBe(3);
  },
);

it("serves seeded and admin translations with canonical fallback and keeps idea topics unchanged", async () => {
  const en = await h.call<TopicDetailDto>("GET", "/topics/energy");
  const ru = await h.call<TopicDetailDto>("GET", "/topics/energy?locale=ru");
  expect([en.body.name, ru.body.name]).toEqual(["Energy", "Энергетика"]);
  expect(ru.body).toMatchObject({ slug: en.body.slug, id: en.body.id });

  const admin = await h.user("locale-admin", "admin");
  const member = await h.user("locale-reader");
  expect(
    (await h.call<MeResponse>("GET", "/me", { token: member.token })).body.preferences.locale,
  ).toBeNull();
  const url = "/topics/energy/translations/ru";
  const body = { name: "Чистая энергия", description: "Новый перевод." };
  const denied = await h.call<ErrorResponse>("PUT", url, { token: member.token, body });
  expect(denied.body.error.details.reason).toBe("action_forbidden");
  const saved = await h.call("PUT", url, { token: admin.token, body });
  const retried = await h.call("PUT", url, { token: admin.token, body });
  expect(saved.body).toEqual({ locale: "ru", ...body });
  expect(retried.body).toEqual(saved.body);
  const ledger = await h.call<Page<ActivityDto>>("GET", "/activity?action=topic.translation_updated");
  expect(ledger.body.items.map(({ payload }) => payload)).toEqual([{ slug: "energy", locale: "ru" }]);
  await ensureBaseTopics(h.db);
  const listed = await h.call<TopicDetailDto[]>("GET", "/topics", { headers: russian });
  expect(listed.body.find(({ slug }) => slug === "energy")!.name).toBe(body.name);
  expect(listed.body.find(({ slug }) => slug === "technology")!.name).toBe("Technology");
  expect(listed.headers.get("content-language")).toBe("ru");

  const idea = await h.idea(member.token, { topics: ["energy"] });
  const detail = await h.call("GET", `/ideas/${idea.slug}?locale=ru`);
  expect(detail.body.topics).toEqual(idea.topics);
  expect(detail.body.topics[0].name).toBe("Energy");
  expect(detail.headers.get("content-language")).toBeNull();
});

it("preserves stable error reasons and coded validation across concurrent locales", async () => {
  const [ru, en] = await Promise.all([
    h.call<ErrorResponse>("GET", "/me", { headers: russian }),
    h.call<ErrorResponse>("GET", "/me", { headers: english }),
  ]);
  expect([ru.status, en.status]).toEqual([401, 401]);
  expect(ru.body.error.details.reason).toBe("sign_in_required");
  expect(ru.body.error.details).toEqual(en.body.error.details);
  expect(ru.body.error.message).toBe("Войдите, чтобы выполнить это действие.");
  expect(en.body.error.message).toBe("Sign in to do this.");
  expect(ru.headers.get("content-language")).toBe("ru");
  expect(ru.headers.get("cache-control")).toBe("no-store");

  const bad = await h.call<ErrorResponse>("POST", "/auth/register", {
    headers: russian,
    body: { handle: "a", displayName: "Valid Name", email: "bad", password: "valid password" },
  });
  expect(bad.status).toBe(400);
  expect(bad.body.error.details).toMatchObject({
    reason: "invalid_request",
    issues: [
      {
        path: "handle",
        code: "too_small",
        message: "Минимальное число символов: 3.",
        params: { minimum: 3 },
      },
      { path: "email", code: "invalid_format", params: { format: "email" } },
    ],
  });

  const member = await h.user("locale-validator");
  const idea = await h.idea(member.token);
  const custom = await h.call<ErrorResponse>("POST", `/ideas/${idea.id}/claims`, {
    token: member.token,
    body: { role: "prerequisite" },
  });
  expect(custom.body.error.details.issues).toMatchObject([
    {
      path: "",
      code: "custom",
      params: { reason: "claim_reference" },
    },
  ]);
});
