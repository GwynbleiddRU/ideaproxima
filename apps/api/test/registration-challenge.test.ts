import { createHash } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { RegistrationChallenge } from "@ideaproxima/contracts";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import { usedRegistrationChallenges } from "../src/db/schema";
import { purgeUsedChallenges } from "../src/modules/identity/challenge";
import { createHarness, type Harness } from "./harness";

const env = {
  NODE_ENV: "test",
  REGISTRATION_CHALLENGE: "pow",
  CHALLENGE_SECRET: "registration-test-secret".repeat(2),
  CLIENT_IP_HEADER: "x-real-ip",
  RATE_LIMITS: "off",
};
const account = (handle: string) => ({
  confirmAge: true,
  handle,
  displayName: handle,
  email: handle + "@example.test",
  password: "correct horse battery",
});
let h: Harness;
beforeAll(async () => {
  h = await createHarness(env);
});
afterAll(async () => {
  await h.close();
});

async function issue(headers?: Record<string, string>) {
  const res = await h.call<RegistrationChallenge>("GET", "/auth/challenge", { headers });
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  return res.body;
}

function solve(puzzle: RegistrationChallenge) {
  for (let n = 0; n <= puzzle.maxNumber; n++) {
    if (
      createHash("sha256")
        .update(puzzle.salt + n)
        .digest("hex") === puzzle.challenge
    )
      return { ...puzzle, number: n };
  }
  throw new Error("Unsolvable registration puzzle");
}

it("returns null in none mode and keeps ordinary registration working", async () => {
  const app = createApp({ db: h.db, config: loadConfig({ NODE_ENV: "test", RATE_LIMITS: "off" }) });
  expect(await (await app.request("/v1/auth/challenge")).json()).toBeNull();
  expect(
    (
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(account("no-puzzle")),
      })
    ).status,
  ).toBe(201);
});

it("admits exactly one concurrent registration with the same proof across two instances", async () => {
  const proof = solve(await issue());
  const other = createApp({ db: h.db, config: loadConfig(env) });
  const [first, second] = await Promise.all([
    h.call("POST", "/auth/register", { body: { ...account("first-solver"), challenge: proof } }),
    other.request("/v1/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...account("second-solver"), challenge: proof }),
    }),
  ]);
  expect([first.status, second.status].sort()).toEqual([201, 400]);
  const replay = await h.call("POST", "/auth/register", { body: { ...account("replay"), challenge: proof } });
  expect(replay.body.error.details.reason).toBe("invalid_registration_challenge");
});

it("rejects missing, incorrect, tampered, expired and wrong-network proofs before consuming the salt", async () => {
  const headers = { "x-real-ip": "192.0.2.1" };
  const proof = solve(await issue(headers));
  const send = (challenge: unknown, network = headers) =>
    h.call("POST", "/auth/register", {
      body: { ...account("valid-solver"), challenge },
      headers: network,
    });
  const oldClock = vi.spyOn(Date, "now").mockReturnValue(Date.now() - 301_000);
  let expired;
  try {
    expired = await issue(headers);
  } finally {
    oldClock.mockRestore();
  }
  for (const challenge of [
    undefined,
    solve(expired),
    { ...proof, number: (proof.number + 1) % (proof.maxNumber + 1) },
    { ...proof, number: proof.maxNumber + 1 },
    { ...proof, maxNumber: proof.maxNumber + 1 },
    { ...proof, expiresAt: new Date(Date.now() + 600_000).toISOString() },
    { ...proof, signature: "0".repeat(64) },
  ]) {
    const rejected = await send(challenge);
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.details.reason).toBe("invalid_registration_challenge");
  }
  expect((await send(proof, { "x-real-ip": "192.0.2.2" })).status).toBe(400);
  const dbError = vi.spyOn(h.db, "execute").mockRejectedValueOnce(new Error("offline"));
  try {
    const unavailable = await send(proof);
    expect(unavailable.status).toBe(503);
    expect(unavailable.body.error.details.reason).toBe("challenge_unavailable");
  } finally {
    dbError.mockRestore();
  }
  expect((await send(proof)).status).toBe(201);
  // Even an account conflict after verification consumes the proof.
  const conflictProof = solve(await issue(headers));
  expect((await send(conflictProof)).status).toBe(409);
  expect((await send(conflictProof)).body.error.details.reason).toBe("invalid_registration_challenge");
  await h.db.insert(usedRegistrationChallenges).values({ salt: "expired", expiresAt: new Date(0) });
  await purgeUsedChallenges(h.db);
  const receipts = await h.db.select().from(usedRegistrationChallenges);
  expect(receipts.map((row) => row.salt)).toContain(proof.salt);
  expect(receipts.map((row) => row.salt)).not.toContain("expired");
});

it("doubles work per spent daily unit across instances, isolates networks and caps the cost", async () => {
  const config = loadConfig({
    ...env,
    RATE_LIMITS: "on",
    RATE_LIMIT_STORE: "postgres",
    RATE_LIMIT_KEY_SECRET: "test",
    RATE_LIMIT_OVERRIDES: JSON.stringify({
      "auth.register": {
        anonymous: [
          { limit: 10, periodSeconds: 60 },
          { limit: 10, periodSeconds: 86400 },
        ],
      },
    }),
  });
  const reader = createApp({ db: h.db, config });
  const writer = createApp({ db: h.db, config });
  const headers = { "x-real-ip": "192.0.2.3", "content-type": "application/json" };
  const get = async (network = headers) => {
    const response = await reader.request("/v1/auth/challenge", { headers: network });
    expect(response.status).toBe(200);
    return (await response.json()) as RegistrationChallenge;
  };
  try {
    const initial = solve(await get());
    expect(initial.maxNumber).toBe(50_000);
    for (const expected of [100_000, 200_000, 400_000, 800_000, 800_000]) {
      const res = await writer.request("/v1/auth/register", {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...account("adaptive"),
          challenge: expected === 100_000 ? undefined : initial,
        }),
      });
      expect(res.status).toBe(400);
      expect((await get()).maxNumber).toBe(expected);
    }
    expect((await get({ ...headers, "x-real-ip": "192.0.2.4" })).maxNumber).toBe(50_000);
  } finally {
    await reader.closeRateLimits();
    await writer.closeRateLimits();
  }
});
