import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Player, TournamentDetail, Trade } from "../api/client";
import { api } from "../api/client";
import { shareTournament } from "../api/share";
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
            <a
              className="btn btn-green text-sm"
              target="_blank"
              rel="noreferrer"
              href={shareTournament({
                tournamentId: t.id,
                tournamentName: t.name,
              })}
              title="Compartir torneo en WhatsApp"
            >
              📲 Compartir
            </a>
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
        <div className="space-y-6">
          {t.format === "groups_knockout" ? (
            <PlayersPanel
              players={players}
              byGroup={true}
              standings={standings}
              qualifyPerGroup={t.qualify_per_group}
            />
          ) : (
            <StandingsTable
              standings={standings.slice(0, 12)}
              byGroup={false}
              qualifyPerGroup={t.qualify_per_group}
            />
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </div>
      )}

      {tab === "players" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {players.map((p) => {
            const s = standings.find((x) => x.player_id === p.id) ?? null;
            return (
              <div key={p.id} className="flex flex-col items-center gap-2">
                <FutCard player={p} size="sm" standing={s} flippable />
                {p.group_label && (
                  <span className="chip text-xs">Grupo {p.group_label}</span>
                )}
              </div>
            );
          })}
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
          tournamentId={t.id}
          tournamentName={t.name}
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

function PlayersPanel({
  players,
  byGroup,
  standings,
  qualifyPerGroup,
}: {
  players: Player[];
  byGroup: boolean;
  standings: TournamentDetail["standings"];
  qualifyPerGroup: number;
}) {
  if (!byGroup || players.every((p) => !p.group_label)) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 justify-items-center">
        {players.map((p) => (
          <FutCard key={p.id} player={p} size="sm" />
        ))}
      </div>
    );
  }

  const byLabel = new Map<string, Player[]>();
  for (const p of players) {
    const key = p.group_label ?? "—";
    if (!byLabel.has(key)) byLabel.set(key, []);
    byLabel.get(key)!.push(p);
  }
  const labels = [...byLabel.keys()].sort();
  const standingsByGroup = new Map<
    string,
    TournamentDetail["standings"]
  >();
  for (const s of standings) {
    const key = s.group_label ?? "—";
    if (!standingsByGroup.has(key)) standingsByGroup.set(key, []);
    standingsByGroup.get(key)!.push(s);
  }

  return (
    <div className="group-grid">
      {labels.map((label) => (
        <GroupPanel
          key={label}
          label={label}
          players={byLabel.get(label) ?? []}
          standings={standingsByGroup.get(label) ?? []}
          qualifyPerGroup={qualifyPerGroup}
        />
      ))}
    </div>
  );
}

function GroupPanel({
  label,
  players,
  standings,
  qualifyPerGroup,
}: {
  label: string;
  players: Player[];
  standings: TournamentDetail["standings"];
  qualifyPerGroup: number;
}) {
  const hasStandings =
    standings.length > 0 && standings.some((s) => s.pj > 0);
  const ordered = hasStandings
    ? [...players].sort((a, b) => {
        const sa = standings.find((s) => s.player_id === a.id);
        const sb = standings.find((s) => s.player_id === b.id);
        return (sa?.group_position ?? 99) - (sb?.group_position ?? 99);
      })
    : [...players].sort((a, b) => b.team_ovr - a.team_ovr);

  return (
    <section className="group-panel">
      <header className="group-panel__header">
        <div className="group-panel__letter" aria-hidden>
          {label}
        </div>
        <div className="group-panel__title">
          <div className="fm-eyebrow">Group stage</div>
          <h3 className="group-panel__name">Grupo {label}</h3>
        </div>
        <div className="group-panel__count">
          {players.length}
          <span>jug</span>
        </div>
      </header>

      <ul
        className={`group-panel__list ${
          hasStandings ? "group-panel__list--stats" : "group-panel__list--preview"
        }`}
      >
        {ordered.map((p, idx) => {
          const s = standings.find((x) => x.player_id === p.id);
          const pos = s?.group_position || 0;
          const qualifies =
            hasStandings &&
            qualifyPerGroup > 0 &&
            pos > 0 &&
            pos <= qualifyPerGroup;
          const photo = api.mediaUrl(p.photo_filename);
          return (
            <li
              key={p.id}
              className={`group-row ${qualifies ? "group-row--q" : ""} ${
                hasStandings ? "group-row--stats" : "group-row--preview"
              }`}
            >
              <span className="group-row__pos">
                {hasStandings ? pos || "—" : idx + 1}
              </span>
              <div className="group-row__avatar">
                {photo ? (
                  <img src={photo} alt={p.display_name} />
                ) : (
                  <span>
                    {p.display_name
                      .split(/\s+/)
                      .map((w) => w[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                )}
                <span className="group-row__ovr">{p.team_ovr}</span>
              </div>
              <div className="group-row__info">
                <div className="group-row__name">{p.display_name}</div>
                <div className="group-row__team">
                  {p.team_type === "club" ? "🏆" : "🏳️"} {p.team_name}
                </div>
              </div>
              {hasStandings && s ? (
                <>
                  <div className="group-row__stats">
                    <Stat k="PJ" v={s.pj} />
                    <Stat k="G" v={s.pg} className="group-row__stat--g" />
                    <Stat k="E" v={s.pe} />
                    <Stat k="P" v={s.pp} className="group-row__stat--p" />
                    <Stat
                      k="DIF"
                      v={`${s.dif > 0 ? "+" : ""}${s.dif}`}
                      className={
                        s.dif > 0
                          ? "group-row__stat--g"
                          : s.dif < 0
                            ? "group-row__stat--p"
                            : ""
                      }
                    />
                  </div>
                  <div className="group-row__pts">
                    <span>{s.pts}</span>
                    <small>pts</small>
                  </div>
                </>
              ) : (
                <>
                  <span className="group-row__bombo">Bombo {p.bombo}</span>
                  <span className="group-row__ovr-big">
                    {p.team_ovr}
                    <small>ovr</small>
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {!hasStandings && (
        <div className="group-panel__legend group-panel__legend--pending">
          <span className="group-panel__dot group-panel__dot--pending" />
          Sin partidos aún · ordenado por OVR
        </div>
      )}
      {hasStandings && qualifyPerGroup > 0 && (
        <div className="group-panel__legend">
          <span className="group-panel__dot" /> Clasifican: top{" "}
          {qualifyPerGroup}
        </div>
      )}
    </section>
  );
}

function Stat({
  k,
  v,
  className = "",
}: {
  k: string;
  v: number | string;
  className?: string;
}) {
  return (
    <div className={`group-row__stat ${className}`}>
      <span className="group-row__stat-v">{v}</span>
      <span className="group-row__stat-k">{k}</span>
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
              Enviamos un enlace de confirmación a{" "}
              <span className="mono">
                {done.proposer.email_hint ?? "tu correo"}
              </span>{" "}
              y a{" "}
              <span className="mono">
                {done.receiver.email_hint ?? "tu contraparte"}
              </span>
              . Cuando ambos hagan clic, los equipos se intercambiarán
              automáticamente.
            </p>
            {done.delivery?.proposer?.backend !== "smtp" && (
              <div
                className="chip chip--totw block"
                style={{ whiteSpace: "normal", textAlign: "left" }}
              >
                SMTP no configurado — pide al administrador que te envíe el
                enlace desde el panel.
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
                Eres…
              </label>
              <select
                className="input w-full"
                value={proposerId ?? ""}
                onChange={(e) =>
                  setProposerId(Number(e.target.value) || null)
                }
              >
                <option value="">Selecciona tu nombre</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} — {p.team_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="fm-eyebrow block mb-1" style={{ fontSize: 10 }}>
                Quieres cambiar tu equipo con…
              </label>
              <select
                className="input w-full"
                value={receiverId ?? ""}
                onChange={(e) =>
                  setReceiverId(Number(e.target.value) || null)
                }
              >
                <option value="">Selecciona con quién</option>
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
                Tu correo registrado
              </label>
              <input
                type="email"
                className="input w-full"
                placeholder="jugador@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p
                className="text-xs mt-1"
                style={{ color: "var(--fm-ink-muted)" }}
              >
                Te enviamos un enlace de confirmación para que nadie pueda
                cambiar tu equipo sin tu permiso.
              </p>
            </div>
            <div>
              <label className="fm-eyebrow block mb-1" style={{ fontSize: 10 }}>
                Mensaje (opcional)
              </label>
              <input
                className="input w-full"
                maxLength={200}
                placeholder="“te cambio Inter por tu City”"
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
