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
const TOKEN_KEY = "fc26_admin_token";

export const adminToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request<T>(path: string, init?: RequestInit, requireAuth = false): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (requireAuth) {
    const t = adminToken.get();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail =
          typeof body.detail === "string"
            ? body.detail
            : JSON.stringify(body.detail);
      }
    } catch {
      /* noop */
    }
    throw new Error(detail);
  }
  // 204 no content safeguard
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function requestMultipart<T>(path: string, body: FormData): Promise<T> {
  const t = adminToken.get();
  const headers: Record<string, string> = {};
  if (t) headers["Authorization"] = `Bearer ${t}`;
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body,
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      if (j?.detail) detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {
      /* noop */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

// Tipos torneo
export type TournamentFormat = "groups_knockout" | "league" | "knockout";
export type TournamentStatus =
  | "draft"
  | "groups"
  | "knockout"
  | "finished";
export type MatchStage =
  | "group"
  | "league"
  | "round_of_16"
  | "quarter"
  | "semi"
  | "final"
  | "third_place";
export type MatchStatus = "scheduled" | "played";

export interface Tournament {
  id: string;
  name: string;
  sorteo_id: string | null;
  format: TournamentFormat;
  status: TournamentStatus;
  num_groups: number;
  qualify_per_group: number;
  points_win: number;
  points_draw: number;
  points_loss: number;
  double_round: boolean;
  created_at: string;
}

export interface Player {
  id: number;
  tournament_id: string;
  display_name: string;
  team_name: string;
  team_type: "club" | "nation";
  team_ovr: number;
  team_att: number;
  team_mid: number;
  team_def: number;
  bombo: number;
  pick_order: number;
  group_label: string | null;
  photo_filename: string | null;
  email: string | null;
}

export type TradeStatus =
  | "pending"
  | "confirmed"
  | "awaiting_admin"
  | "executed"
  | "cancelled"
  | "expired";

export interface TradePlayerSummary {
  id: number;
  display_name: string;
  team_name: string;
  team_type: "club" | "nation";
  team_ovr: number;
  bombo: number;
  photo_filename: string | null;
  email_hint: string | null;
}

export interface TradeDelivery {
  sent: boolean;
  backend: "smtp" | "log" | "error";
  detail: string;
  email: string | null;
  link: string | null;
}

export interface Trade {
  id: string;
  tournament_id: string;
  status: TradeStatus;
  message: string | null;
  created_at: string;
  expires_at: string;
  executed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  proposer_confirmed_at: string | null;
  receiver_confirmed_at: string | null;
  proposer: TradePlayerSummary;
  receiver: TradePlayerSummary;
  delivery?: { proposer?: TradeDelivery; receiver?: TradeDelivery };
  role?: "proposer" | "receiver";
  proposer_token?: string;
  receiver_token?: string;
}

export interface Match {
  id: number;
  tournament_id: string;
  stage: MatchStage;
  round_number: number;
  group_label: string | null;
  home_player_id: number | null;
  away_player_id: number | null;
  home_score: number | null;
  away_score: number | null;
  status: MatchStatus;
  played_at: string | null;
  slot_home: string | null;
  slot_away: string | null;
  bracket_position: number | null;
}

export interface StandingRow {
  player_id: number;
  display_name: string;
  team_name: string;
  team_ovr: number;
  photo_filename: string | null;
  group_label: string | null;
  group_position: number;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  dif: number;
  pts: number;
}

export interface TournamentDetail {
  tournament: Tournament;
  players: Player[];
  matches: Match[];
  standings: StandingRow[];
}

export const api = {
  pool: (n: number) => request<PoolResponse>(`/pool?participants=${n}`),
  sortear: (body: {
    participants: Array<string | { name: string; email: string | null }>;
    mode: Mode;
    seed: number | null;
  }) =>
    request<SorteoResponse>(
      "/sorteo",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      true, // sorteo ahora requiere admin
    ),
  getSorteo: (id: string) => request<SorteoResponse>(`/sorteo/${id}`),
  verify: (id: string) => request<VerifyResponse>(`/sorteo/${id}/verify`),
  listSorteos: (limit = 20, offset = 0) =>
    request<SorteoListResponse>(`/sorteos?limit=${limit}&offset=${offset}`),
  exportUrl: (id: string, format: "csv" | "json" | "md") =>
    `${BASE}/sorteo/${id}/export?format=${format}`,

  // Admin
  adminStatus: () =>
    request<{ token: string; configured: boolean }>("/admin/status"),
  adminLogin: (password: string) =>
    request<{ token: string; configured: boolean }>("/admin/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  // Tournaments (public read)
  listTournaments: () => request<Tournament[]>("/tournaments"),
  getTournament: (id: string) =>
    request<TournamentDetail>(`/tournaments/${id}`),
  getStandings: (id: string) =>
    request<StandingRow[]>(`/tournaments/${id}/standings`),

  // Tournaments (admin)
  createTournament: (body: {
    name: string;
    sorteo_id?: string | null;
    format: TournamentFormat;
    num_groups: number;
    qualify_per_group: number;
    double_round?: boolean;
  }) =>
    request<Tournament>(
      "/admin/tournaments",
      { method: "POST", body: JSON.stringify(body) },
      true,
    ),
  updateTournament: (id: string, body: Partial<Tournament>) =>
    request<Tournament>(
      `/admin/tournaments/${id}`,
      { method: "PATCH", body: JSON.stringify(body) },
      true,
    ),
  deleteTournament: (id: string) =>
    request<{ deleted: string }>(
      `/admin/tournaments/${id}`,
      { method: "DELETE" },
      true,
    ),
  assignGroups: (id: string, regenerate = false) =>
    request<Player[]>(
      `/admin/tournaments/${id}/assign-groups?regenerate=${regenerate}`,
      { method: "POST" },
      true,
    ),
  generateFixture: (id: string, regenerate = false) =>
    request<Match[]>(
      `/admin/tournaments/${id}/generate-fixture?regenerate=${regenerate}`,
      { method: "POST" },
      true,
    ),
  advanceKnockout: (id: string, regenerate = false) =>
    request<Match[]>(
      `/admin/tournaments/${id}/advance-knockout?regenerate=${regenerate}`,
      { method: "POST" },
      true,
    ),
  setMatchResult: (match_id: number, home: number, away: number) =>
    request<Match>(
      `/admin/matches/${match_id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ home_score: home, away_score: away }),
      },
      true,
    ),
  clearMatchResult: (match_id: number) =>
    request<Match>(
      `/admin/matches/${match_id}/result`,
      { method: "DELETE" },
      true,
    ),
  updatePlayer: (player_id: number, body: Partial<Player>) =>
    request<Player>(
      `/admin/players/${player_id}`,
      { method: "PATCH", body: JSON.stringify(body) },
      true,
    ),
  uploadPhoto: (player_id: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return requestMultipart<Player>(
      `/admin/players/${player_id}/photo`,
      fd,
    );
  },
  deletePhoto: (player_id: number) =>
    request<Player>(
      `/admin/players/${player_id}/photo`,
      { method: "DELETE" },
      true,
    ),

  mediaUrl: (filename: string | null) =>
    filename ? `/media/${filename}` : null,

  // Trades
  proposeTrade: (
    tournament_id: string,
    body: {
      proposer_id: number;
      receiver_id: number;
      proposer_email: string;
      message?: string;
    },
  ) =>
    request<Trade>(`/tournaments/${tournament_id}/trades`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getTrade: (token: string) => request<Trade>(`/trades/${token}`),
  confirmTrade: (token: string) =>
    request<Trade>(`/trades/${token}/confirm`, { method: "POST" }),
  cancelTrade: (token: string) =>
    request<Trade>(`/trades/${token}/cancel`, { method: "POST" }),
  adminListTrades: (tournament_id: string) =>
    request<Trade[]>(
      `/admin/tournaments/${tournament_id}/trades`,
      undefined,
      true,
    ),
  adminCancelTrade: (trade_id: string) =>
    request<Trade>(
      `/admin/trades/${trade_id}`,
      { method: "DELETE" },
      true,
    ),
  adminAuthorizeTrade: (trade_id: string) =>
    request<Trade>(
      `/admin/trades/${trade_id}/authorize`,
      { method: "POST" },
      true,
    ),

  // Registrations
  registerPublic: (name: string, email: string) =>
    request<Registration>("/registrations", {
      method: "POST",
      body: JSON.stringify({ name, email }),
    }),
  registrationCount: () =>
    request<{ pending: number }>("/registrations/count"),
  adminListRegistrations: (status?: "pending" | "used" | "removed") =>
    request<Registration[]>(
      `/admin/registrations${status ? `?status=${status}` : ""}`,
      undefined,
      true,
    ),
  adminDeleteRegistration: (id: number) =>
    request<{ removed: number }>(
      `/admin/registrations/${id}`,
      { method: "DELETE" },
      true,
    ),
};

export interface Registration {
  id: number;
  name: string;
  email: string;
  created_at: string;
  status: "pending" | "used" | "removed";
  used_in_sorteo_id: string | null;
  notes: string | null;
}
