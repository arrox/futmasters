import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { TournamentDetail } from "../api/client";
import { api } from "../api/client";
import BracketView from "../components/BracketView";
import FixtureList from "../components/FixtureList";
import FutCard from "../components/FutCard";
import StandingsTable from "../components/StandingsTable";
import { formatLabel, statusLabel } from "./AdminHome";

export default function TournamentPublic() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<TournamentDetail | null>(null);
  const [tab, setTab] = useState<"overview" | "players" | "standings" | "fixture" | "bracket">(
    "overview",
  );

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    const load = () => api.getTournament(id).then((d) => mounted && setData(d));
    load();
    const t = setInterval(load, 8000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [id]);

  if (!data) return <div className="card">Cargando torneo…</div>;
  const { tournament: t, players, matches, standings } = data;

  return (
    <div className="space-y-6">
      <div className="card relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(0,212,255,0.35), transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,107,107,0.25), transparent 45%)",
          }}
        />
        <div className="relative flex justify-between flex-wrap gap-3 items-start">
          <div>
            <div className="text-xs uppercase tracking-widest text-accent">
              Copa FUT
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold">{t.name}</h1>
            <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-400">
              <span className="chip">{statusLabel(t.status)}</span>
              <span>{formatLabel(t.format)}</span>
              {t.format === "groups_knockout" && (
                <span>
                  {t.num_groups} grupos · {t.qualify_per_group} clasifican
                </span>
              )}
              <span>{players.length} jugadores</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/" className="btn btn-ghost text-sm">
              Inicio
            </Link>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-soft/40 overflow-x-auto">
        {(
          [
            ["overview", "Resumen"],
            ["players", "Jugadores"],
            ["standings", "Posiciones"],
            ["fixture", "Fixture"],
            ["bracket", "Llaves"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              tab === k
                ? "border-accent text-accent"
                : "border-transparent text-slate-400 hover:text-slate-100"
            }`}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="card">
              <h2 className="font-semibold mb-3">Últimos resultados</h2>
              <RecentResults
                matches={matches.filter((m) => m.status === "played")}
                players={players}
              />
            </div>
            <div className="card">
              <h2 className="font-semibold mb-3">Próximos partidos</h2>
              <UpcomingMatches matches={matches} players={players} />
            </div>
          </div>
          <div>
            <StandingsTable
              standings={standings.slice(0, 8)}
              byGroup={t.format === "groups_knockout"}
              qualifyPerGroup={t.qualify_per_group}
            />
          </div>
        </div>
      )}

      {tab === "players" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {players.map((p) => (
            <div key={p.id} className="flex flex-col items-center gap-2">
              <FutCard player={p} size="sm" />
              {p.group_label && (
                <span className="chip text-xs">Grupo {p.group_label}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "standings" && (
        <StandingsTable
          standings={standings}
          qualifyPerGroup={t.qualify_per_group}
          byGroup={t.format === "groups_knockout"}
        />
      )}

      {tab === "fixture" && (
        <FixtureList
          matches={matches.filter(
            (m) => m.stage === "group" || m.stage === "league",
          )}
          players={players}
        />
      )}

      {tab === "bracket" && (
        <BracketView matches={matches} players={players} />
      )}
    </div>
  );
}

function RecentResults({
  matches,
  players,
}: {
  matches: TournamentDetail["matches"];
  players: TournamentDetail["players"];
}) {
  const pMap = new Map(players.map((p) => [p.id, p]));
  const recent = [...matches]
    .sort((a, b) => (b.played_at ?? "").localeCompare(a.played_at ?? ""))
    .slice(0, 5);
  if (recent.length === 0)
    return <p className="text-slate-400 text-sm">Sin partidos jugados aún.</p>;
  return (
    <ul className="space-y-2">
      {recent.map((m) => (
        <li
          key={m.id}
          className="flex items-center justify-between text-sm bg-bg/40 rounded px-3 py-2"
        >
          <div className="flex-1 text-right font-medium truncate">
            {m.home_player_id ? pMap.get(m.home_player_id)?.display_name : "?"}
          </div>
          <div className="mono px-3 font-bold">
            {m.home_score} — {m.away_score}
          </div>
          <div className="flex-1 font-medium truncate">
            {m.away_player_id ? pMap.get(m.away_player_id)?.display_name : "?"}
          </div>
        </li>
      ))}
    </ul>
  );
}

function UpcomingMatches({
  matches,
  players,
}: {
  matches: TournamentDetail["matches"];
  players: TournamentDetail["players"];
}) {
  const pMap = new Map(players.map((p) => [p.id, p]));
  const upcoming = matches
    .filter((m) => m.status === "scheduled" && m.home_player_id && m.away_player_id)
    .slice(0, 5);
  if (upcoming.length === 0)
    return <p className="text-slate-400 text-sm">Sin partidos pendientes.</p>;
  return (
    <ul className="space-y-2">
      {upcoming.map((m) => (
        <li
          key={m.id}
          className="flex items-center justify-between text-sm bg-bg/40 rounded px-3 py-2"
        >
          <div className="flex-1 text-right font-medium truncate">
            {m.home_player_id ? pMap.get(m.home_player_id)?.display_name : "?"}
          </div>
          <div className="mono text-slate-400 px-3">vs</div>
          <div className="flex-1 font-medium truncate">
            {m.away_player_id ? pMap.get(m.away_player_id)?.display_name : "?"}
          </div>
        </li>
      ))}
    </ul>
  );
}
