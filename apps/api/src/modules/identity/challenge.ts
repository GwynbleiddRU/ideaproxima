import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import type { RegisterRequest, RegistrationChallenge } from "@ideaproxima/contracts";
import { DomainError } from "@ideaproxima/domain";
import { queryRows, type Database } from "../../db/client";

type Solution = RegisterRequest["challenge"];
export interface ChallengeProvider {
  issue(network: string): Promise<RegistrationChallenge>;
  verify(network: string, solution: Solution, priorRegistrations: number): Promise<void>;
}

function maxNumber(spent: number) {
  return 50_000 * 2 ** Math.min(4, spent);
}

const digest = (salt: string, n: number) =>
  createHash("sha256")
    .update(salt + n)
    .digest("hex");
const invalid = () => new DomainError("validation_failed", "invalid_registration_challenge");

export function proofOfWork(
  db: Database,
  secret: string,
  registrationDebt: (network: string) => Promise<number>,
): ChallengeProvider {
  function sign(network: string, proof: Omit<RegistrationChallenge, "signature">) {
    const { algorithm, salt, challenge, maxNumber, expiresAt } = proof;
    return createHmac("sha256", secret)
      .update(JSON.stringify([network, algorithm, salt, challenge, maxNumber, expiresAt]))
      .digest();
  }

  return {
    async issue(network) {
      const limit = maxNumber(await registrationDebt(network));
      const salt = randomBytes(16).toString("hex");
      const proof = {
        algorithm: "SHA-256" as const,
        salt,
        challenge: digest(salt, randomInt(limit + 1)),
        maxNumber: limit,
        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      };
      return { ...proof, signature: sign(network, proof).toString("hex") };
    },
    async verify(network, proof, priorRegistrations) {
      if (
        !proof ||
        proof.number > proof.maxNumber ||
        proof.maxNumber < maxNumber(priorRegistrations) ||
        Date.parse(proof.expiresAt) <= Date.now() ||
        !timingSafeEqual(sign(network, proof), Buffer.from(proof.signature, "hex")) ||
        digest(proof.salt, proof.number) !== proof.challenge
      )
        throw invalid();

      // The unique insert commits before password hashing. Use the purge clock for the expiry guard too.
      let receipts;
      try {
        receipts = await queryRows(
          db,
          sql`insert into used_registration_challenges (salt, expires_at)
          select ${proof.salt}, ${proof.expiresAt}::timestamptz where ${proof.expiresAt}::timestamptz > clock_timestamp()
          on conflict (salt) do nothing returning used_registration_challenges.salt`,
        );
      } catch {
        throw new DomainError("unavailable", "challenge_unavailable");
      }
      if (!receipts.length) throw invalid();
    },
  };
}

export async function purgeUsedChallenges(db: Database) {
  await db.execute(
    sql`delete from used_registration_challenges where used_registration_challenges.expires_at <= now()`,
  );
}
