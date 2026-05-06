import type { Assignment, BombosPreview, Group } from "../api/client";

/**
 * Serialización canónica equivalente a:
 *   json.dumps(obj, sort_keys=True, ensure_ascii=False)
 * en Python (con separadores por defecto ", " y ": ").
 * Necesaria para que el hash SHA-256 coincida con el producido por el backend.
 */
export function canonicalStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite number");
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map((v) => canonicalStringify(v)).join(", ") + "]";
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as object).sort();
    return (
      "{" +
      keys
        .map((k) => JSON.stringify(k) + ": " + canonicalStringify((value as any)[k]))
        .join(", ") +
      "}"
    );
  }
  throw new Error(`unsupported type: ${typeof value}`);
}

export interface CanonicalInput {
  timestamp: string;
  mode: string;
  seed: number | null;
  participants: string[];
  pool_used: string[];
  bombos: BombosPreview[];
  assignments: Assignment[];
  groups: Group[] | null;
}

export function buildCanonicalPayload(input: CanonicalInput): Record<string, unknown> {
  return {
    timestamp: input.timestamp,
    mode: input.mode,
    seed: input.seed,
    participants: input.participants,
    pool_used: input.pool_used,
    bombos: input.bombos.map((b) => ({
      numero: b.numero,
      equipos: b.equipos.map((e) => (typeof e === "string" ? e : e.name)),
    })),
    assignments: input.assignments.map((a) => ({
      participant: a.participant,
      team: a.team,
      ovr: a.ovr,
      bombo: a.bombo,
      pick_order: a.pick_order,
    })),
    groups:
      input.groups === null
        ? null
        : input.groups.map((g) => ({
            nombre: g.nombre,
            integrantes: g.integrantes.map((i) => ({
              participant: i.participant,
              team: i.team,
              ovr: i.ovr,
              bombo: i.bombo,
            })),
          })),
  };
}

export async function computeHash(canonical: Record<string, unknown>): Promise<string> {
  const raw = canonicalStringify(canonical);
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyHash(
  canonical: Record<string, unknown>,
  expected: string,
): Promise<boolean> {
  const h = await computeHash(canonical);
  // tiempo-constante
  if (h.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
