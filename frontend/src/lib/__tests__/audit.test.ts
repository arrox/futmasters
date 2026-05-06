import { describe, expect, it } from "vitest";
import { buildCanonicalPayload, canonicalStringify, computeHash } from "../audit";
import seedData from "../../data/seed.json";
import type { SorteoResponse } from "../../api/client";

describe("canonicalStringify", () => {
  it("matches Python json.dumps(sort_keys=True, ensure_ascii=False) separators", () => {
    expect(canonicalStringify({ b: 1, a: 2 })).toBe('{"a": 2, "b": 1}');
    expect(canonicalStringify([1, 2, 3])).toBe("[1, 2, 3]");
    expect(canonicalStringify("España")).toBe('"España"');
    expect(canonicalStringify(null)).toBe("null");
  });
});

describe("hash de seed backend", () => {
  it("recomputa el hash de cada sorteo del seed y coincide con el almacenado", async () => {
    for (const s of seedData as SorteoResponse[]) {
      const canonical = buildCanonicalPayload({
        timestamp: s.timestamp,
        mode: s.mode,
        seed: s.seed,
        participants: s.participants,
        pool_used: s.pool.map((t) => t.name),
        bombos: s.bombos,
        assignments: s.assignments,
        groups: s.groups,
      });
      const h = await computeHash(canonical);
      expect(h).toBe(s.hash);
    }
  });
});
