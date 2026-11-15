import { describe, expect, it } from "vitest";
import { isUuid, uuidv7 } from "../src/lib/ids";

describe("uuidv7", () => {
  it("produces valid version-7 UUIDs", () => {
    const id = uuidv7();
    expect(isUuid(id)).toBe(true);
    expect(id[14]).toBe("7");
    expect(["8", "9", "a", "b"]).toContain(id[19]);
  });

  it("is strictly increasing within a process, even inside one millisecond", () => {
    const ids = Array.from({ length: 5000 }, () => uuidv7(1_700_000_000_000));
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("encodes the timestamp in the leading bits", () => {
    const later = uuidv7(Date.now() + 10_000);
    expect(parseInt(later.replace(/-/g, "").slice(0, 12), 16)).toBeGreaterThanOrEqual(
      Date.now() + 10_000 - 1,
    );
  });
});
