/**
 * Cliente HTTP para la API del backend FC 26.
 * Todas las funciones lanzan un Error con mensaje parseado si la respuesta no es 2xx.
 */

export type TeamType = "club" | "nation";

export interface Team {
  name: string;
  type: TeamType;
  ovr: number;
  att: number;
  mid: number;
  def: number;
  bombo: number;
  priority: number;
}

export interface BombosPreview {
  numero: number;
  equipos: Team[];
  ovr_range: string;
}

export type Mode = "simple" | "bombo_equilibrado" | "draft_bombos";

export interface PoolResponse {
  participants: number;
  pool: Team[];
  clubs_count: number;
  nations_count: number;
  bombos: BombosPreview[];
  available_modes: Mode[];
}

export interface Assignment {
  participant: string;
  team: string;
  ovr: number;
  bombo: number;
  pick_order: number;
}

export interface GroupMember {
  participant: string;
  team: string;
  ovr: number;
  bombo: number;
}

export interface Group {
  nombre: string;
  integrantes: GroupMember[];
}

export interface SorteoResponse {
  sorteo_id: string;
  timestamp: string;
  mode: Mode;
  seed: number | null;
  participants: string[];
  pool: Team[];
  bombos: BombosPreview[];
  assignments: Assignment[];
  groups: Group[] | null;
  hash: string;
  warnings: string[];
}

export interface VerifyResponse {
  sorteo_id: string;
  verified: boolean;
  stored_hash: string;
  computed_hash: string;
}

export interface SorteoListItem {
  id: string;
  timestamp: string;
  mode: Mode;
  seed: number | null;
  num_participants: number;
  hash: string;
}

export interface SorteoListResponse {
  total: number;
  limit: number;
  offset: number;
  items: SorteoListItem[];
}

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      /* noop */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export const api = {
  pool: (n: number) => request<PoolResponse>(`/pool?participants=${n}`),
  sortear: (body: {
    participants: string[];
    mode: Mode;
    seed: number | null;
  }) =>
    request<SorteoResponse>("/sorteo", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getSorteo: (id: string) => request<SorteoResponse>(`/sorteo/${id}`),
  verify: (id: string) => request<VerifyResponse>(`/sorteo/${id}/verify`),
  listSorteos: (limit = 20, offset = 0) =>
    request<SorteoListResponse>(`/sorteos?limit=${limit}&offset=${offset}`),
  exportUrl: (id: string, format: "csv" | "json" | "md") =>
    `${BASE}/sorteo/${id}/export?format=${format}`,
};
