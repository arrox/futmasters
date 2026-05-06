import type { Match, Player } from "../api/client";
import { api } from "../api/client";
import { shareMatchResult } from "../api/share";

interface Props {
  matches: Match[];
  players: Player[];
  tournamentId?: string;
  tournamentName?: string;
  editable?: boolean;
  onSubmit?: (matchId: number, home: number, away: number) => Promise<void>;
  onClear?: (matchId: number) => Promise<void>;
  stageFilter?: string;
}

export default function FixtureList({
  matches,
  players,
  tournamentId,
  tournamentName,
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
                tournamentId={tournamentId}
                tournamentName={tournamentName}
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
  tournamentId?: string;
  tournamentName?: string;
}

import { useState } from "react";

function MatchRow({
  match,
  home,
  away,
  editable,
  onSubmit,
  onClear,
  tournamentId,
  tournamentName,
}: RowProps) {
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

  const homePhoto = home ? api.mediaUrl(home.photo_filename) : null;
  const awayPhoto = away ? api.mediaUrl(away.photo_filename) : null;
  const played = match.status === "played";

  return (
    <li className="scoreboard">
      <div className="scoreboard__main">
        <PlayerSide
          side="home"
          name={home?.display_name ?? match.slot_home ?? "—"}
          team={home?.team_name ?? ""}
          ovr={home?.team_ovr ?? null}
          photo={homePhoto}
        />
        <div className="scoreboard__score">
          {editable && !awaitingPlayers ? (
            <div className="scoreboard__inputs">
              <input
                type="number"
                min={0}
                max={99}
                value={h}
                onChange={(e) => setH(e.target.value)}
                className="scoreboard__input"
                aria-label="Goles local"
              />
              <span className="scoreboard__sep">:</span>
              <input
                type="number"
                min={0}
                max={99}
                value={a}
                onChange={(e) => setA(e.target.value)}
                className="scoreboard__input"
                aria-label="Goles visitante"
              />
            </div>
          ) : (
            <div className="scoreboard__digits" data-played={played}>
              <span className="scoreboard__digit">
                {match.home_score ?? "–"}
              </span>
              <span className="scoreboard__sep">:</span>
              <span className="scoreboard__digit">
                {match.away_score ?? "–"}
              </span>
            </div>
          )}
          <div className="scoreboard__status">
            {played ? "FIN" : awaitingPlayers ? "POR DEFINIR" : "PROGRAMADO"}
          </div>
        </div>
        <PlayerSide
          side="away"
          name={away?.display_name ?? match.slot_away ?? "—"}
          team={away?.team_name ?? ""}
          ovr={away?.team_ovr ?? null}
          photo={awayPhoto}
        />
      </div>
      {editable && (
        <div className="scoreboard__actions">
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
      {match.status === "played" && (
        <div className="scoreboard__actions">
          {tournamentId && home && away && (
            <a
              className="btn btn-green"
              style={{ fontSize: 11, padding: "4px 10px" }}
              target="_blank"
              rel="noreferrer"
              href={shareMatchResult({
                matchId: match.id,
                tournamentId,
                tournamentName: tournamentName ?? "FutMasters",
                homeName: home.display_name,
                awayName: away.display_name,
                homeScore: match.home_score ?? 0,
                awayScore: match.away_score ?? 0,
                stageLabel:
                  match.stage === "group"
                    ? `Grupo ${match.group_label ?? ""} · Fecha ${match.round_number}`
                    : match.stage === "league"
                      ? `Fecha ${match.round_number}`
                      : stageDisplay(match.stage),
              })}
            >
              📲 Compartir
            </a>
          )}
        </div>
      )}
      {error && (
        <span className="text-coral text-xs basis-full">{error}</span>
      )}
    </li>
  );
}

interface PlayerSideProps {
  side: "home" | "away";
  name: string;
  team: string;
  ovr: number | null;
  photo: string | null;
}

function PlayerSide({ side, name, team, ovr, photo }: PlayerSideProps) {
  return (
    <div className={`scoreboard__side scoreboard__side--${side}`}>
      <div className="scoreboard__avatar">
        {photo ? (
          <img src={photo} alt={name} />
        ) : (
          <span className="scoreboard__initials">
            {name
              .split(/\s+/)
              .map((w) => w[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
        )}
        {ovr !== null && <span className="scoreboard__ovr">{ovr}</span>}
      </div>
      <div className="scoreboard__info">
        <div className="scoreboard__name">{name}</div>
        {team && <div className="scoreboard__team">{team}</div>}
      </div>
    </div>
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
