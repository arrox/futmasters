import type { BombosPreview, Team } from "../api/client";

export const NUM_BOMBOS_DEFAULT = 4;

export function computeNumBombos(n: number): number {
  if (n < 1) throw new Error("n debe ser >= 1");
  return n < NUM_BOMBOS_DEFAULT ? n : NUM_BOMBOS_DEFAULT;
}

export function computeBomboSizes(n: number): number[] {
  const b = computeNumBombos(n);
  const base = Math.floor(n / b);
  const extra = n % b;
  return Array.from({ length: b }, (_, i) => base + (i < extra ? 1 : 0));
}

export function buildBombos(pool: Team[]): BombosPreview[] {
  if (pool.length === 0) return [];
  const ordered = [...pool].sort((a, b) => (b.ovr - a.ovr) || (a.priority - b.priority));
  const sizes = computeBomboSizes(pool.length);
  const out: BombosPreview[] = [];
  let cursor = 0;
  sizes.forEach((size, idx) => {
    const equipos = ordered.slice(cursor, cursor + size).map((t) => ({ ...t }));
    cursor += size;
    const ovrs = equipos.map((e) => e.ovr);
    const ovr_range = ovrs.length ? `${Math.min(...ovrs)}-${Math.max(...ovrs)}` : "";
    out.push({ numero: idx + 1, equipos, ovr_range });
  });
  return out;
}

export function bomboOfTeam(bombos: BombosPreview[], teamName: string): number {
  for (const b of bombos) {
    if (b.equipos.some((e) => e.name === teamName)) return b.numero;
  }
  throw new Error(`Equipo no encontrado en bombos: ${teamName}`);
}
