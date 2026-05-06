/**
 * Implementación local de los endpoints de sorteo usando IndexedDB (Dexie).
 * Reemplaza las llamadas HTTP al backend Python cuando el build es PWA standalone.
 */
import type {
  Mode,
  PoolResponse,
  SorteoListResponse,
  SorteoResponse,
  VerifyResponse,
} from "./client";
import { buildBombos } from "../lib/bombos";
import { db, type SorteoRow } from "../lib/db";
import { describePool, selectEffectivePool } from "../lib/poolSelector";
import { TEAMS } from "../lib/teams";
import { availableModes, ejecutarSorteo } from "../lib/sorteo";
import { buildCanonicalPayload, computeHash } from "../lib/audit";

function newSorteoId(): string {
  // UUIDv4-ish vía crypto.randomUUID
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  a[6] = (a[6] & 0x0f) | 0x40;
  a[8] = (a[8] & 0x3f) | 0x80;
  const h = [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function localPool(n: number): Promise<PoolResponse> {
  const pool = selectEffectivePool(n);
  const bombos = buildBombos(pool);
  const desc = describePool(pool);
  return {
    participants: n,
    pool,
    clubs_count: desc.clubs_count,
    nations_count: desc.nations_count,
    bombos,
    available_modes: availableModes(n, bombos.length),
  };
}

export async function localListTeams() {
  return [...TEAMS];
}

export async function localSortear(body: {
  participants: Array<string | { name: string; email: string | null }>;
  mode: Mode;
  seed: number | null;
}): Promise<SorteoResponse> {
  // Validación + unicidad case-insensitive
  const names = body.participants.map((p) => (typeof p === "string" ? p : p.name).trim());
  const seen = new Set<string>();
  for (const n of names) {
    if (!n) throw new Error("Nombre vacío en participantes");
    if (n.length > 50) throw new Error("Nombre de más de 50 caracteres");
    const key = n.toLowerCase();
    if (seen.has(key)) throw new Error("Nombres duplicados (case-insensitive)");
    seen.add(key);
  }

  const result = ejecutarSorteo(body.participants, body.mode, body.seed);
  const timestamp = new Date().toISOString().replace("Z", "+00:00");

  const canonical = buildCanonicalPayload({
    timestamp,
    mode: body.mode,
    seed: body.seed,
    participants: names,
    pool_used: result.pool.map((t) => t.name),
    bombos: result.bombos,
    assignments: result.assignments,
    groups: result.groups,
  });
  const hash = await computeHash(canonical);

  const sorteo_id = newSorteoId();
  const response: SorteoResponse = {
    sorteo_id,
    timestamp,
    mode: body.mode,
    seed: body.seed,
    participants: names,
    pool: result.pool,
    bombos: result.bombos,
    assignments: result.assignments,
    groups: result.groups,
    hash,
    warnings: [],
  };

  const row: SorteoRow = {
    sorteo_id,
    timestamp,
    mode: body.mode,
    seed: body.seed,
    num_participants: names.length,
    hash,
    payload: response,
  };
  await db.sorteos.put(row);
  return response;
}

export async function localGetSorteo(id: string): Promise<SorteoResponse> {
  const row = await db.sorteos.get(id);
  if (!row) throw new Error(`Sorteo no encontrado: ${id}`);
  return row.payload;
}

export async function localVerify(id: string): Promise<VerifyResponse> {
  const row = await db.sorteos.get(id);
  if (!row) throw new Error(`Sorteo no encontrado: ${id}`);
  const s = row.payload;
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
  const computed_hash = await computeHash(canonical);
  return {
    sorteo_id: id,
    stored_hash: s.hash,
    computed_hash,
    verified: computed_hash === s.hash,
  };
}

export async function localListSorteos(limit = 20, offset = 0): Promise<SorteoListResponse> {
  const total = await db.sorteos.count();
  const items = await db.sorteos
    .orderBy("timestamp")
    .reverse()
    .offset(offset)
    .limit(limit)
    .toArray();
  return {
    total,
    limit,
    offset,
    items: items.map((r) => ({
      id: r.sorteo_id,
      timestamp: r.timestamp,
      mode: r.mode as Mode,
      seed: r.seed,
      num_participants: r.num_participants,
      hash: r.hash,
    })),
  };
}
