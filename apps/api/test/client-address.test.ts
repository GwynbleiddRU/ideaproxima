import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config";
import { networkKey } from "../src/http/client-address";

const socket = "192.0.2.18";
const key = (env: NodeJS.ProcessEnv, headers: Record<string, string> = {}, peer = socket) =>
  networkKey(loadConfig(env), new Headers(headers), peer);

describe("client network keys", () => {
  it("selects the configured hop from the right and falls back to the socket on short chains", () => {
    const chain = { "x-forwarded-for": "192.0.2.1, 203.0.113.7, 198.51.100.4" };
    expect(key({}, chain)).toBe("v4:192.0.2.18");
    expect(key({ TRUST_PROXY_HOPS: "1" }, chain)).toBe("v4:198.51.100.4");
    expect(key({ TRUST_PROXY_HOPS: "2" }, chain)).toBe("v4:203.0.113.7");
    expect(key({ TRUST_PROXY_HOPS: "4" }, chain)).toBe("v4:192.0.2.18");
    expect(key({ TRUST_PROXY_HOPS: "1" })).toBe("v4:192.0.2.18");
  });

  it("gives a configured single-value edge header precedence", () => {
    const env = { TRUST_PROXY_HOPS: "1", CLIENT_IP_HEADER: "X-Real-IP" };
    const forwarded = { "x-forwarded-for": "198.51.100.2" };
    expect(key(env, { ...forwarded, "x-real-ip": "203.0.113.8" })).toBe("v4:203.0.113.8");
    expect(key(env, forwarded)).toBe("v4:192.0.2.18");
    expect(key(env, { "x-real-ip": "192.0.2.1, 192.0.2.2" })).toBe("unknown");
  });

  it("warns on the deprecated one-hop alias and honours an explicit hop count", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(loadConfig({ TRUST_PROXY: "true" }).trustProxyHops).toBe(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("deprecated"));
      expect(loadConfig({ TRUST_PROXY: "true", TRUST_PROXY_HOPS: "0" }).trustProxyHops).toBe(0);
    } finally {
      warn.mockRestore();
    }
  });

  it("normalises mapped IPv4, IPv6 spelling and configurable prefixes", () => {
    expect(key({}, {}, "::ffff:203.0.113.7")).toBe("v4:203.0.113.7");
    expect(key({}, {}, "0:0:0:0:0:ffff:cb00:7107")).toBe("v4:203.0.113.7");
    for (const peer of ["2001:DB8:ABCD:12::1", "2001:db8:abcd:0012:ffff::2"])
      expect(key({}, {}, peer)).toBe("v6:2001:db8:abcd:12::/64");
    expect(key({ RATE_LIMIT_IPV6_PREFIX: "57" }, {}, "2001:db8:abcd:12ff::")).toBe(
      "v6:2001:db8:abcd:1280::/57",
    );
    expect(key({}, {}, "garbage")).toBe("unknown");
    expect(networkKey(loadConfig({}), new Headers())).toBe("unknown");
  });
});
