import type { Team } from "../api/client";
import { TEAMS } from "./teams";

export function splitPool(): { clubs: Team[]; nations: Team[] } {
  const sorted = [...TEAMS].sort((a, b) => a.priority - b.priority);
  return {
    clubs: sorted.filter((t) => t.type === "club"),
    nations: sorted.filter((t) => t.type === "nation"),
  };
}

export function selectEffectivePool(n: number): Team[] {
  if (n < 1) throw new Error("n debe ser >= 1");
  if (n > TEAMS.length) throw new Error(`n no puede exceder ${TEAMS.length} (pool total)`);
  const { clubs, nations } = splitPool();
  if (n <= clubs.length) return clubs.slice(0, n).map((t) => ({ ...t }));
  const faltan = n - clubs.length;
  return [...clubs.map((t) => ({ ...t })), ...nations.slice(0, faltan).map((t) => ({ ...t }))];
}

export function describePool(pool: Team[]): { clubs_count: number; nations_count: number } {
  return {
    clubs_count: pool.filter((t) => t.type === "club").length,
    nations_count: pool.filter((t) => t.type === "nation").length,
  };
}
