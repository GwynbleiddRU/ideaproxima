import { gcra, type RateLimitRule } from "@ideaproxima/domain";
import type { RateLimitKey, RateLimitStore } from "./store";

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly arrivals = new Map<RateLimitKey, number>();
  private readonly sweep: NodeJS.Timeout;

  constructor(private readonly capacity = 200_000) {
    if (!Number.isSafeInteger(capacity) || capacity < 1)
      throw new RangeError("Expected a positive key capacity");
    this.sweep = setInterval(() => {
      const nowUs = Date.now() * 1000;
      for (const [key, tat] of this.arrivals) if (tat <= nowUs) this.arrivals.delete(key);
    }, 30_000).unref();
  }

  async consume(key: RateLimitKey, rule: RateLimitRule, cost = 1) {
    const { tatUs, decision } = gcra(rule, this.arrivals.get(key) ?? null, Date.now() * 1000, cost);
    if (decision.allowed) {
      // Insertion order tracks the last successful charge. Eviction at capacity is constant time.
      this.arrivals.delete(key);
      if (this.arrivals.size === this.capacity) this.arrivals.delete(this.arrivals.keys().next().value!);
      this.arrivals.set(key, tatUs!);
    }
    return decision;
  }

  async peek(key: RateLimitKey, rule: RateLimitRule) {
    return gcra(rule, this.arrivals.get(key) ?? null, Date.now() * 1000, 1, "peek").decision;
  }

  async reset(key: RateLimitKey) {
    this.arrivals.delete(key);
  }

  async close() {
    clearInterval(this.sweep);
    this.arrivals.clear();
  }
}
