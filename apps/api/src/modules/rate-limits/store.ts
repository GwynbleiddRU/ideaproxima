import { createHmac } from "node:crypto";
import type {
  RateLimitDecision,
  RateLimitPolicyName,
  RateLimitRule,
  RateLimitScope,
} from "@ideaproxima/domain";

export function rateLimitKey(
  policy: RateLimitPolicyName,
  ruleIndex: number,
  scope: RateLimitScope,
  subject: string,
  secret: string,
) {
  const id =
    scope === "account"
      ? subject
      : createHmac("sha256", secret)
          .update(scope === "email" ? subject.trim().toLowerCase() : subject)
          .digest("hex");
  return `rl:${policy}:${ruleIndex}:${scope}:${id}` as const;
}

export type RateLimitKey = ReturnType<typeof rateLimitKey>;
export interface RateLimitStore {
  consume(key: RateLimitKey, rule: RateLimitRule, cost?: number): Promise<RateLimitDecision>;
  peek(key: RateLimitKey, rule: RateLimitRule): Promise<RateLimitDecision>;
  reset(key: RateLimitKey): Promise<void>;
  close(): Promise<void>;
}
