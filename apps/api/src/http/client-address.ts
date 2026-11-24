import { isIP } from "node:net";
import type { Context } from "hono";
import type { AppConfig } from "../config";
import type { AppEnv } from "./env";

type AddressConfig = Pick<AppConfig, "http" | "rateLimits">;

/** Canonical IPv6 text, including the hexadecimal form of embedded IPv4 addresses. */
function canonicalV6(address: string) {
  return new URL(`http://[${address}]/`).hostname.slice(1, -1);
}

export function networkKey(config: AddressConfig, headers: Headers, socket?: string): string {
  let address = socket;
  const { clientIpHeader, trustProxyHops } = config.http;
  if (clientIpHeader) {
    address = headers.get(clientIpHeader)?.trim() ?? socket;
  } else if (trustProxyHops > 0) {
    address = headers.get("x-forwarded-for")?.split(",").at(-trustProxyHops)?.trim() ?? socket;
  }
  if (!address) return "unknown";
  const family = isIP(address);
  if (family === 4) return `v4:${address}`;
  if (family !== 6) return "unknown";

  // The interface zone on a socket's link-local address is outside the address bits.
  const canonical = canonicalV6(address.split("%")[0]!);
  const [left, right = ""] = canonical.split("::");
  const head = left ? left.split(":") : [];
  const tail = right ? right.split(":") : [];
  const words = [...head, ...Array<string>(8 - head.length - tail.length).fill("0"), ...tail].map((word) =>
    parseInt(word, 16),
  );
  if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
    const high = words[6]!;
    const low = words[7]!;
    return `v4:${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`;
  }
  const prefix = config.rateLimits.ipv6Prefix;
  const masked = words.map((word, i) => {
    const bits = Math.max(0, Math.min(16, prefix - 16 * i));
    return (word & (0xffff << (16 - bits))).toString(16);
  });
  return `v6:${canonicalV6(masked.join(":"))}/${prefix}`;
}

export function clientAddress(c: Context<AppEnv>) {
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming;
  return networkKey(c.get("config"), c.req.raw.headers, incoming?.socket?.remoteAddress);
}
