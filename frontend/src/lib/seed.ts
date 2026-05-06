import type { SorteoResponse } from "../api/client";
import seedData from "../data/seed.json";
import { db, type SorteoRow } from "./db";

const SEED_MARKER = "fc26_seed_v1";

export async function bootstrapSeedIfNeeded(): Promise<{ loaded: number }> {
  if (typeof localStorage !== "undefined" && localStorage.getItem(SEED_MARKER)) {
    return { loaded: 0 };
  }
  const existing = await db.sorteos.count();
  if (existing > 0) {
    if (typeof localStorage !== "undefined") localStorage.setItem(SEED_MARKER, "done");
    return { loaded: 0 };
  }
  const rows: SorteoRow[] = (seedData as SorteoResponse[]).map((s) => ({
    sorteo_id: s.sorteo_id,
    timestamp: s.timestamp,
    mode: s.mode,
    seed: s.seed,
    num_participants: s.participants.length,
    hash: s.hash,
    payload: s,
  }));
  await db.sorteos.bulkPut(rows);
  if (typeof localStorage !== "undefined") localStorage.setItem(SEED_MARKER, "done");
  return { loaded: rows.length };
}
