import type { Match, Player } from "../api/client";

interface Props {
  matches: Match[];
  players: Player[];
  editable?: boolean;
  onSubmit?: (matchId: number, home: number, away: number) => Promise<void>;
  onClear?: (matchId: number) => Promise<void>;
  stageFilter?: string;
}

export default function FixtureList({
  matches,
  players,
  editable = false,
  onSubmit,
  onClear,
  stageFilter,
}: Props) {
  const pMap = new Map(players.map((p) => [p.id, p]));
  const list = stageFilter
    ? matches.filter((m) => m.stage === stageFilter)
    : matches;

  const rounds = groupBy(list, (m) => {
    if (m.stage === "group")
      return `Grupo ${m.group_label ?? "—"} · Fecha ${m.round_number}`;
    if (m.stage === "league") return `Fecha ${m.round_number}`;
    return stageDisplay(m.stage);
  });
  const keys = Object.keys(rounds);

  if (keys.length === 0) {
    return <p className="text-slate-400 text-sm">Sin partidos.</p>;
  }

  return (
    <div className="space-y-4">
      {keys.map((k) => (
        <div key={k} className="fm-surface">
          <div className="mb-3">
            <div className="fm-eyebrow">Fixture</div>
            <h3
              className="fm-display"
              style={{
                fontSize: 18,
                color: "var(--fm-gold)",
                marginTop: 2,
              }}
            >
              {k}
            </h3>
          </div>
          <ul className="space-y-2">
            {rounds[k].map((m) => (
              <MatchRow
                key={m.id}
                match={m}
                home={m.home_player_id ? pMap.get(m.home_player_id) : undefined}
                away={m.away_player_id ? pMap.get(m.away_player_id) : undefined}
                editable={editable}
                onSubmit={onSubmit}
                onClear={onClear}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

interface RowProps {
  match: Match;
  home?: Player;
  away?: Player;
  editable: boolean;
  onSubmit?: (matchId: number, home: number, away: number) => Promise<void>;
  onClear?: (matchId: number) => Promise<void>;
}

import { useState } from "react";

function MatchRow({ match, home, away, editable, onSubmit, onClear }: RowProps) {
  const [h, setH] = useState<string>(
    match.home_score !== null ? String(match.home_score) : "",
  );
  const [a, setA] = useState<string>(
    match.away_score !== null ? String(match.away_score) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const awaitingPlayers =
    !match.home_player_id || !match.away_player_id;

  async function save() {
    const hv = Number(h), av = Number(a);
    if (!Number.isFinite(hv) || !Number.isFinite(av) || hv < 0 || av < 0) {
      setError("Scores inválidos");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (onSubmit) await onSubmit(match.id, hv, av);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    if (!onClear) return;
    setSaving(true);
    setError(null);
    try {
      await onClear(match.id);
      setH("");
      setA("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex items-center gap-3 flex-wrap bg-bg/40 border border-soft/40 rounded-md px-3 py-2">
      <div className="flex-1 flex items-center justify-between gap-2 min-w-[260px]">
        <div className="flex-1 text-right">
          <div className="font-medium">{home?.display_name ?? (match.slot_home ?? "—")}</div>
          <div className="text-xs text-slate-400">{home?.team_name ?? ""}</div>
        </div>
        <div className="flex items-center gap-2 mono">
          {editable && !awaitingPlayers ? (
            <>
              <input
                type="number"
                min={0}
                max={99}
                value={h}
                onChange={(e) => setH(e.target.value)}
                className="input w-12 text-center px-1"
              />
              <span className="text-slate-500">vs</span>
              <input
                type="number"
                min={0}
                max={99}
                value={a}
                onChange={(e) => setA(e.target.value)}
                className="input w-12 text-center px-1"
              />
            </>
          ) : (
            <>
              <span className="text-xl font-bold w-8 text-center">
                {match.home_score ?? "—"}
              </span>
              <span className="text-slate-500 text-xs">vs</span>
              <span className="text-xl font-bold w-8 text-center">
                {match.away_score ?? "—"}
              </span>
            </>
          )}
        </div>
        <div className="flex-1">
          <div className="font-medium">{away?.display_name ?? (match.slot_away ?? "—")}</div>
          <div className="text-xs text-slate-400">{away?.team_name ?? ""}</div>
        </div>
      </div>
      {editable && (
        <div className="flex gap-1 items-center">
          {awaitingPlayers ? (
            <span className="text-xs text-slate-500">esperando ganadores</span>
          ) : (
            <>
              <button
                className="btn btn-primary text-xs py-1 px-2"
                onClick={save}
                disabled={saving}
              >
                {match.status === "played" ? "Editar" : "Guardar"}
              </button>
              {match.status === "played" && (
                <button
                  className="btn btn-ghost text-xs py-1 px-2"
                  onClick={clear}
                  disabled={saving}
                >
                  Borrar
                </button>
              )}
            </>
          )}
        </div>
      )}
      {match.status === "played" && !editable && (
        <span className="chip text-[10px]">✓ jugado</span>
      )}
      {error && (
        <span className="text-coral text-xs basis-full">{error}</span>
      )}
    </li>
  );
}

function stageDisplay(stage: string): string {
  return (
    {
      round_of_16: "Octavos de final",
      quarter: "Cuartos de final",
      semi: "Semifinales",
      final: "Final",
      third_place: "3° y 4° puesto",
      group: "Grupos",
      league: "Liga",
    } as Record<string, string>
  )[stage] ?? stage;
}

function groupBy<T, K extends string>(
  arr: T[],
  fn: (t: T) => K,
): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of arr) {
    const k = fn(item);
    if (!out[k]) out[k] = [];
    out[k].push(item);
  }
  return out;
}
