import { describe, expect, it } from "vitest";
import type { GraphDto } from "@ideaproxima/contracts";
import { ApiError, errorMessage } from "@/api/http";
import { parseExploreSearch, parseGraphSearch, parseRedirectSearch } from "@/app/search-params";
import type { ActivityDto } from "@ideaproxima/contracts";
import { foldActivity } from "@/lib/activity";
import { diffLines, hasChanges } from "@/lib/diff";
import { dayLabel, initials, shortAgo, timeAgo } from "@/lib/format";
import { resolveLocale } from "@/locales/preferences";
import { layoutGraph } from "@/lib/graph-layout";
import { renderMarkdown } from "@/lib/markdown";

describe("diffLines", () => {
  it("marks added and removed lines and keeps common ones", () => {
    const lines = diffLines("a\nb\nc", "a\nB\nc\nd");
    expect(lines).toEqual([
      { kind: "same", text: "a" },
      { kind: "removed", text: "b" },
      { kind: "added", text: "B" },
      { kind: "same", text: "c" },
      { kind: "added", text: "d" },
    ]);
    expect(hasChanges(lines)).toBe(true);
    expect(hasChanges(diffLines("same", "same"))).toBe(false);
  });

  it("treats an empty side as nothing, not one empty line", () => {
    expect(diffLines("", "x")).toEqual([{ kind: "added", text: "x" }]);
    expect(diffLines("x", "")).toEqual([{ kind: "removed", text: "x" }]);
  });
});

describe("renderMarkdown", () => {
  it("escapes raw HTML into visible text", () => {
    const html = renderMarkdown('<script>alert(1)</script> <img src=x onerror="y">');
    expect(html).not.toMatch(/<script|<img/);
    expect(html).toContain("&lt;script&gt;");
  });

  it("drops dangerous link protocols, whatever their case", () => {
    expect(renderMarkdown("[x](javascript:alert(1))")).toBe('<p><a href="">x</a></p>');
    expect(renderMarkdown("[x](JaVaScRiPt:alert(1))")).toBe('<p><a href="">x</a></p>');
  });

  it("turns claim anchors into in-page links carrying the claim id", () => {
    const id = "0190f5c2-1234-7abc-8def-0123456789ab";
    expect(renderMarkdown(`see [this claim](claim:${id})`)).toContain(
      `<a href="#claim-${id}">this claim</a>`,
    );
  });
});

describe("layoutGraph", () => {
  const ref = (id: string) => ({ id, slug: id, title: id, stage: "imagined" as const, topics: [] });
  it("puts foundations left of the focus, what builds on it to the right, alternatives beside it", () => {
    const graph: GraphDto = {
      focusId: "focus",
      nodes: [
        { ...ref("focus"), distance: 0 },
        { ...ref("foundation"), distance: 1 },
        { ...ref("application"), distance: 1 },
        { ...ref("alternative"), distance: 1 },
      ],
      edges: [
        { id: "e1", type: "requires", from: "focus", to: "foundation" },
        { id: "e2", type: "applies", from: "application", to: "focus" },
        { id: "e3", type: "alternative_to", from: "focus", to: "alternative" },
      ],
    };
    const { nodes, columns, minLayer } = layoutGraph(graph);
    const layer = Object.fromEntries(nodes.map((n) => [n.id, n.layer]));
    expect(layer).toEqual({ focus: 0, foundation: -1, application: 1, alternative: 0 });
    expect(columns).toBe(3);
    expect(minLayer).toBe(-1);
    expect(nodes[0]!.id).toBe("focus");
  });
});

describe("route search parsers", () => {
  it("keep only values they recognise", () => {
    expect(parseExploreSearch({ lens: "neglected", stage: "tested", topic: " energy " })).toEqual({
      lens: "neglected",
      stage: "tested",
      topic: "energy",
      tag: undefined,
      q: undefined,
    });
    expect(parseExploreSearch({ lens: "made-up", stage: "finished" })).toMatchObject({
      lens: undefined,
      stage: undefined,
    });
    expect(parseGraphSearch({ direction: "upstream", depth: "9" })).toEqual({
      direction: "upstream",
      depth: undefined,
    });
  });

  it("accept only same-site post-login destinations (no open redirects)", () => {
    expect(parseRedirectSearch({ redirect: "/ideas/x?tab=1" }).redirect).toBe("/ideas/x?tab=1");
    expect(parseRedirectSearch({ redirect: "https://evil.example" }).redirect).toBeUndefined();
    expect(parseRedirectSearch({ redirect: "//evil.example" }).redirect).toBeUndefined();
  });
});

describe("errorMessage", () => {
  it("names the fields a validation error is about", () => {
    const error = new ApiError(400, "validation_failed", "Invalid request.", {
      issues: [{ path: "source.kind", message: "Invalid option" }],
    });
    expect(errorMessage(error)).toBe("Please check: source kind — Invalid option");
  });

  it("speaks plainly about sessions, rate limits and the network", () => {
    expect(errorMessage(new ApiError(401, "unauthenticated", "x"))).toMatch(/sign in/);
    expect(errorMessage(new ApiError(429, "rate_limited", "x"))).toMatch(/wait a moment/);
    expect(errorMessage(new TypeError("Failed to fetch"))).toMatch(/connection/);
  });
});

describe("format", () => {
  it("makes initials and relative times", () => {
    expect(initials("Mira Okafor (demo)")).toBe("MO");
    const now = Date.parse("2026-11-15T12:00:00Z");
    expect(timeAgo("2026-11-12T12:00:00Z", now)).toBe("3 days ago");
    expect(timeAgo("2026-11-15T11:59:50Z", now)).toBe("now");
  });
});

describe("display locale resolution", () => {
  it("uses the first supported preference and falls back to English", () => {
    expect(resolveLocale("zh-TW", "hi", "ar", ["ja"])).toBe("zh-Hans");
    expect(resolveLocale("xx", "pt-PT", "ar", ["ja"])).toBe("pt-BR");
    expect(resolveLocale(undefined, "invalid", "ar", ["ja"])).toBe("ar");
    expect(resolveLocale(undefined, undefined, undefined, ["xx", "ja-JP"])).toBe("ja");
    expect(resolveLocale()).toBe("en");
  });
});

describe("shortAgo and dayLabel", () => {
  const now = new Date("2026-11-16T12:00:00").getTime();
  const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();

  it("gives compact ages, then the date", () => {
    expect(shortAgo(ago(20), now)).toBe("now");
    expect(shortAgo(ago(5 * 60), now)).toBe("5m");
    expect(shortAgo(ago(2 * 3600), now)).toBe("2h");
    expect(shortAgo(ago(3 * 86400), now)).toBe("3d");
    expect(shortAgo(ago(15 * 86400), now)).toBe("2w");
    expect(shortAgo(ago(60 * 86400), now)).toBe("Sep 17");
  });

  it("names today and yesterday, and dates the rest", () => {
    expect(dayLabel(ago(3600), now)).toBe("Today");
    expect(dayLabel(ago(24 * 3600), now)).toBe("Yesterday");
    expect(dayLabel(ago(3 * 86400), now)).toBe("Nov 13, 2026");
  });
});

describe("foldActivity", () => {
  const idea = { id: "i1", slug: "water", title: "Water", stage: "imagined" as const };
  let n = 0;
  const entry = (action: string, payload: Record<string, unknown>, onIdea = idea): ActivityDto => ({
    id: `a${++n}`,
    action,
    actor: { id: `p${n}`, handle: `p${n}`, displayName: `Person ${n}` },
    subject: { kind: "idea", id: onIdea.id, hidden: false },
    payload,
    occurredAt: "2026-11-16T10:00:00.000Z",
    ideaId: onIdea.id,
    idea: onIdea,
  });

  it("folds consecutive identical stances on one idea, and nothing else", () => {
    const other = { ...idea, id: "i2", slug: "soil", title: "Soil" };
    const groups = foldActivity([
      entry("stance.taken", { kind: "important" }),
      entry("stance.taken", { kind: "important" }),
      entry("stance.taken", { kind: "doubtful" }),
      entry("stance.taken", { kind: "doubtful" }, other),
      entry("claim.stated", { statement: "A" }),
      entry("claim.stated", { statement: "B" }),
    ]);
    expect(groups.map((g) => g.entries.length)).toEqual([2, 1, 1, 1, 1]);
  });

  it("only folds neighbours: a repeat after something else starts a new line", () => {
    const groups = foldActivity([
      entry("evaluation.submitted", { target: { kind: "idea" } }),
      entry("comment.posted", { kind: "question" }),
      entry("evaluation.submitted", { target: { kind: "idea" } }),
    ]);
    expect(groups).toHaveLength(3);
  });
});
