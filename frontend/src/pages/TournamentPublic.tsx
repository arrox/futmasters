import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Player, TournamentDetail, Trade } from "../api/client";
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
  const [showTradeModal, setShowTradeModal] = useState(false);

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
          <div className="flex gap-2 flex-wrap">
            <button
              className="btn btn-primary text-sm"
              onClick={() => setShowTradeModal(true)}
            >
              ↔ Intercambiar equipo
            </button>
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

      {showTradeModal && (
        <TradeModal
          players={players}
          tournamentId={t.id}
          onClose={() => setShowTradeModal(false)}
        />
      )}
    </div>
  );
}

function TradeModal({
  players,
  tournamentId,
  onClose,
}: {
  players: Player[];
  tournamentId: string;
  onClose: () => void;
}) {
  const [proposerId, setProposerId] = useState<number | null>(null);
  const [receiverId, setReceiverId] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Trade | null>(null);

  const proposer = players.find((p) => p.id === proposerId) ?? null;

  async function submit() {
    if (!proposerId || !receiverId || !email) return;
    setSaving(true);
    setErr(null);
    try {
      const trade = await api.proposeTrade(tournamentId, {
        proposer_id: proposerId,
        receiver_id: receiverId,
        proposer_email: email,
        message: message || undefined,
      });
      setDone(trade);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(5,7,12,0.85)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="fm-surface max-w-lg w-full"
        style={{ maxHeight: "90vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="fm-eyebrow">Trade proposal</div>
            <h2 className="fm-h2 mt-1">Proponer intercambio</h2>
          </div>
          <button
            className="btn btn-ghost"
            style={{ padding: "4px 10px" }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {done ? (
          <div className="space-y-3">
            <p
              style={{ color: "var(--fm-fut-green)", fontSize: 14 }}
            >
              ✓ Propuesta creada.
            </p>
            <p className="text-sm" style={{ color: "var(--fm-ink-muted)" }}>
              Enviamos un link de confirmación a{" "}
              <span className="mono">
                {done.proposer.email_hint ?? "tu email"}
              </span>{" "}
              y a{" "}
              <span className="mono">
                {done.receiver.email_hint ?? "tu contraparte"}
              </span>
              . Cuando los dos hagan clic, se intercambian los equipos automáticamente.
            </p>
            {done.delivery?.proposer?.backend !== "smtp" && (
              <div
                className="chip chip--totw block"
                style={{ whiteSpace: "normal", textAlign: "left" }}
              >
                SMTP no configurado — pediles al admin que te pase el link
                desde el panel.
              </div>
            )}
            <button className="btn btn-primary w-full" onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="fm-eyebrow block mb-1" style={{ fontSize: 10 }}>
                Sos…
              </label>
              <select
                className="input w-full"
                value={proposerId ?? ""}
                onChange={(e) =>
                  setProposerId(Number(e.target.value) || null)
                }
              >
                <option value="">Elegí tu nombre</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} — {p.team_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="fm-eyebrow block mb-1" style={{ fontSize: 10 }}>
                Querés cambiar tu equipo con…
              </label>
              <select
                className="input w-full"
                value={receiverId ?? ""}
                onChange={(e) =>
                  setReceiverId(Number(e.target.value) || null)
                }
              >
                <option value="">Elegí con quién</option>
                {players
                  .filter((p) => p.id !== proposerId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name} — {p.team_name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="fm-eyebrow block mb-1" style={{ fontSize: 10 }}>
                Tu email registrado
              </label>
              <input
                type="email"
                className="input w-full"
                placeholder="jugador@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p
                className="text-xs mt-1"
                style={{ color: "var(--fm-ink-muted)" }}
              >
                Te mandamos un link de confirmación para que nadie pueda
                cambiar tu equipo sin vos.
              </p>
            </div>
            <div>
              <label className="fm-eyebrow block mb-1" style={{ fontSize: 10 }}>
                Mensaje (opcional)
              </label>
              <input
                className="input w-full"
                maxLength={200}
                placeholder="“te paso Inter por tu City”"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            {err && (
              <p style={{ color: "var(--fm-danger)", fontSize: 12 }}>{err}</p>
            )}
            <button
              className="btn btn-primary w-full"
              disabled={!proposerId || !receiverId || !email || saving}
              onClick={submit}
            >
              {saving ? "Enviando…" : "Enviar propuesta"}
            </button>
          </div>
        )}
      </div>
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
