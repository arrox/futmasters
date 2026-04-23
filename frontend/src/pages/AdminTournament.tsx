import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Player, Trade, TournamentDetail } from "../api/client";
import { api } from "../api/client";
import FixtureList from "../components/FixtureList";
import StandingsTable from "../components/StandingsTable";
import FutCard from "../components/FutCard";
import BracketView from "../components/BracketView";
import { formatLabel, statusLabel } from "./AdminHome";

export default function AdminTournament() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<TournamentDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<
    "jugadores" | "grupos" | "fixture" | "bracket" | "trades"
  >("jugadores");
  const [trades, setTrades] = useState<Trade[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [d, ts] = await Promise.all([
        api.getTournament(id),
        api.adminListTrades(id).catch(() => [] as Trade[]),
      ]);
      setData(d);
      setTrades(ts);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (err) return <div className="card text-coral">{err}</div>;
  if (!data) return <div className="card">Cargando…</div>;

  const { tournament: t, players, matches, standings } = data;
  const hasGroups = players.some((p) => p.group_label);
  const groupMatches = matches.filter((m) => m.stage === "group" || m.stage === "league");
  const allGroupPlayed =
    groupMatches.length > 0 && groupMatches.every((m) => m.status === "played");

  async function wrapAction(fn: () => Promise<unknown>) {
    try {
      await fn();
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Link to="/admin" className="text-accent text-sm">
            ← Volver
          </Link>
          <h1 className="text-2xl font-bold">{t.name}</h1>
          <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-400">
            <span className="chip">{statusLabel(t.status)}</span>
            <span>{formatLabel(t.format)}</span>
            {t.format === "groups_knockout" && (
              <span>
                {t.num_groups} grupos · {t.qualify_per_group} clasifican
              </span>
            )}
          </div>
        </div>
        <Link to={`/t/${t.id}`} className="btn btn-ghost">
          Ver público
        </Link>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Acciones</h2>
        <div className="flex flex-wrap gap-2">
          {t.format === "groups_knockout" && (
            <button
              className="btn btn-primary text-sm"
              onClick={() =>
                wrapAction(() =>
                  api.assignGroups(t.id, hasGroups /* regenerate if already set */),
                )
              }
            >
              {hasGroups ? "Resortear grupos" : "Sortear grupos"}
            </button>
          )}
          <button
            className="btn btn-primary text-sm"
            onClick={() =>
              wrapAction(() =>
                api.generateFixture(t.id, groupMatches.length > 0),
              )
            }
            disabled={t.format === "groups_knockout" && !hasGroups}
          >
            {groupMatches.length > 0 ? "Regenerar fixture" : "Generar fixture"}
          </button>
          {t.format === "groups_knockout" && (
            <button
              className="btn btn-primary text-sm"
              onClick={() =>
                wrapAction(() =>
                  api.advanceKnockout(
                    t.id,
                    matches.some(
                      (m) =>
                        m.stage !== "group" && m.stage !== "league",
                    ),
                  ),
                )
              }
              disabled={!allGroupPlayed}
              title={
                !allGroupPlayed
                  ? "Completa todos los partidos de grupo"
                  : undefined
              }
            >
              Sortear llaves
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-soft/40 overflow-x-auto">
        {(
          [
            "jugadores",
            "grupos",
            "fixture",
            "bracket",
            "trades",
          ] as const
        ).map((x) => (
          <button
            key={x}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              tab === x
                ? "border-accent text-accent"
                : "border-transparent text-slate-400 hover:text-slate-100"
            }`}
            onClick={() => setTab(x)}
          >
            {
              {
                jugadores: "Jugadores",
                grupos: "Posiciones",
                fixture: "Partidos",
                bracket: "Llaves",
                trades: `Intercambios${
                  trades.filter((t) => t.status === "pending" || t.status === "confirmed").length > 0
                    ? ` (${trades.filter((t) => t.status === "pending" || t.status === "confirmed").length})`
                    : ""
                }`,
              }[x]
            }
          </button>
        ))}
      </div>

      {tab === "jugadores" && (
        <PlayersGrid players={players} onUpdated={load} />
      )}

      {tab === "grupos" && (
        <StandingsTable
          standings={standings}
          qualifyPerGroup={t.qualify_per_group}
          byGroup={t.format === "groups_knockout"}
        />
      )}

      {tab === "fixture" && (
        <FixtureList
          matches={groupMatches}
          players={players}
          tournamentId={t.id}
          tournamentName={t.name}
          editable
          onSubmit={async (mid, h, a) => {
            await api.setMatchResult(mid, h, a);
            await load();
          }}
          onClear={async (mid) => {
            await api.clearMatchResult(mid);
            await load();
          }}
        />
      )}

      {tab === "trades" && (
        <AdminTrades
          trades={trades}
          onRefresh={load}
        />
      )}

      {tab === "bracket" && (
        <div className="space-y-6">
          <BracketView matches={matches} players={players} />
          <FixtureList
            matches={matches.filter((m) =>
              ["round_of_16", "quarter", "semi", "final"].includes(m.stage),
            )}
            players={players}
            tournamentId={t.id}
            tournamentName={t.name}
            editable
            onSubmit={async (mid, h, a) => {
              await api.setMatchResult(mid, h, a);
              await load();
            }}
            onClear={async (mid) => {
              await api.clearMatchResult(mid);
              await load();
            }}
          />
        </div>
      )}
    </div>
  );
}

function AdminTrades({
  trades,
  onRefresh,
}: {
  trades: Trade[];
  onRefresh: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  }
  async function cancel(id: string) {
    if (!window.confirm("¿Cancelar este intercambio?")) return;
    try {
      await api.adminCancelTrade(id);
      onRefresh();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function authorize(id: string) {
    if (!window.confirm("¿Autorizar y ejecutar este intercambio?")) return;
    try {
      await api.adminAuthorizeTrade(id);
      onRefresh();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  if (trades.length === 0) {
    return (
      <div className="fm-surface">
        <div className="fm-eyebrow mb-2">Trades</div>
        <p style={{ color: "var(--fm-ink-muted)", fontSize: 13 }}>
          No hay propuestas de intercambio. Cuando alguien proponga una,
          aparecerán los enlaces mágicos para compartir si el correo no llegó.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {trades.map((t) => {
        const pending =
          t.status === "pending" ||
          t.status === "confirmed" ||
          t.status === "awaiting_admin";
        return (
          <div key={t.id} className="fm-surface">
            <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
              <div>
                <div className="fm-eyebrow">
                  {statusChipLabel(t.status)}
                </div>
                <h3
                  className="fm-display"
                  style={{ fontSize: 18, color: "var(--fm-gold)", marginTop: 2 }}
                >
                  {t.proposer.display_name} ↔ {t.receiver.display_name}
                </h3>
                <div className="text-xs text-slate-400 mt-1">
                  <span className="mono">
                    {new Date(t.created_at).toLocaleString()}
                  </span>
                  {" · expira "}
                  <span className="mono">
                    {new Date(t.expires_at).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {t.status === "awaiting_admin" && (
                  <button
                    className="btn btn-green text-xs"
                    onClick={() => authorize(t.id)}
                    style={{ boxShadow: "0 0 18px rgba(0,255,135,0.35)" }}
                  >
                    ✓ Autorizar
                  </button>
                )}
                {pending && (
                  <button
                    className="btn btn-ghost text-xs"
                    onClick={() => cancel(t.id)}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <TradeSide
                role="Propone"
                p={t.proposer}
                confirmedAt={t.proposer_confirmed_at}
                token={t.proposer_token}
                delivery={t.delivery?.proposer}
                onCopy={copy}
                copied={copied}
              />
              <TradeSide
                role="Recibe"
                p={t.receiver}
                confirmedAt={t.receiver_confirmed_at}
                token={t.receiver_token}
                delivery={t.delivery?.receiver}
                onCopy={copy}
                copied={copied}
              />
            </div>
            {t.message && (
              <p
                className="text-sm mt-3 italic"
                style={{ color: "var(--fm-ink-muted)" }}
              >
                “{t.message}”
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TradeSide({
  role,
  p,
  confirmedAt,
  token,
  delivery,
  onCopy,
  copied,
}: {
  role: string;
  p: Trade["proposer"];
  confirmedAt: string | null;
  token?: string;
  delivery?: { backend: string; detail: string; link: string | null };
  onCopy: (s: string) => void;
  copied: string | null;
}) {
  const link = delivery?.link;
  return (
    <div
      style={{
        border: "1px solid rgba(240,196,96,0.18)",
        borderRadius: 10,
        padding: 12,
        background: "rgba(5,7,12,0.5)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="fm-eyebrow" style={{ fontSize: 10 }}>
          {role}
        </span>
        {confirmedAt ? (
          <span className="chip chip--green">✓ confirmó</span>
        ) : (
          <span className="chip">pendiente</span>
        )}
      </div>
      <div className="font-medium">{p.display_name}</div>
      <div className="text-xs text-slate-400 mb-2">
        {p.team_name} · OVR {p.team_ovr} · Bombo {p.bombo}
      </div>
      {p.email_hint && (
        <div className="text-xs mono" style={{ color: "var(--fm-ink-muted)" }}>
          {p.email_hint}
        </div>
      )}
      {link && (
        <div className="mt-2">
          <div
            className="fm-eyebrow"
            style={{ fontSize: 9, marginBottom: 4 }}
          >
            Enlace mágico
          </div>
          <div className="flex gap-1">
            <input
              readOnly
              className="input flex-1 mono"
              style={{ fontSize: 10 }}
              value={link}
              onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
            />
            <button
              className="btn btn-ghost text-xs"
              onClick={() => onCopy(link)}
            >
              {copied === link ? "✓" : "copiar"}
            </button>
          </div>
          <div
            className="text-xs mt-1"
            style={{
              color:
                delivery?.backend === "smtp"
                  ? "var(--fm-fut-green)"
                  : "var(--fm-warning)",
            }}
          >
            {delivery?.detail}
          </div>
        </div>
      )}
    </div>
  );
}

function statusChipLabel(s: string): string {
  return (
    {
      pending: "Pendiente",
      confirmed: "Esperando 2da firma",
      awaiting_admin: "Esperando autorización del administrador",
      executed: "Ejecutado",
      cancelled: "Cancelado",
      expired: "Expirado",
    } as Record<string, string>
  )[s] ?? s;
}

function PlayersGrid({
  players,
  onUpdated,
}: {
  players: Player[];
  onUpdated: () => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {players.map((p) => (
        <PlayerAdminCard key={p.id} player={p} onUpdated={onUpdated} />
      ))}
    </div>
  );
}

function PlayerAdminCard({
  player,
  onUpdated,
}: {
  player: Player;
  onUpdated: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(player.display_name);
  const [email, setEmail] = useState(player.email ?? "");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      await api.uploadPhoto(player.id, f);
      onUpdated();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto() {
    if (!confirm("¿Quitar foto?")) return;
    try {
      await api.deletePhoto(player.id);
      onUpdated();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function saveName() {
    try {
      await api.updatePlayer(player.id, { display_name: name });
      setEditing(false);
      onUpdated();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function saveEmail() {
    setEmailMsg(null);
    setSavingEmail(true);
    try {
      await api.updatePlayer(player.id, { email: email.trim() || null });
      setEmailMsg("✓ guardado");
      setTimeout(() => setEmailMsg(null), 1800);
      onUpdated();
    } catch (err) {
      setEmailMsg((err as Error).message);
    } finally {
      setSavingEmail(false);
    }
  }

  return (
    <div className="card flex flex-col items-center gap-3">
      <FutCard player={player} size="sm" />
      <div className="text-center w-full">
        {editing ? (
          <div className="flex gap-1">
            <input
              className="input flex-1 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="btn btn-primary text-xs" onClick={saveName}>
              ✓
            </button>
            <button
              className="btn btn-ghost text-xs"
              onClick={() => {
                setEditing(false);
                setName(player.display_name);
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <div
            className="font-medium cursor-pointer"
            onClick={() => setEditing(true)}
            title="Click para renombrar"
          >
            {player.display_name}{" "}
            <span className="text-xs text-slate-500">✎</span>
          </div>
        )}
        <div className="text-xs text-slate-400 mt-0.5">
          {player.team_name} · Grupo {player.group_label ?? "—"}
        </div>
      </div>
      <div className="flex gap-2 w-full">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={onFile}
        />
        <button
          className="btn btn-primary text-xs flex-1"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Subiendo…" : player.photo_filename ? "Cambiar foto" : "Subir foto"}
        </button>
        {player.photo_filename && (
          <button
            className="btn btn-ghost text-xs"
            onClick={removePhoto}
            disabled={uploading}
          >
            ✕
          </button>
        )}
      </div>
      <div className="w-full">
        <label
          className="fm-eyebrow block mb-1"
          style={{ fontSize: 9 }}
        >
          Correo (para confirmar intercambios)
        </label>
        <div className="flex gap-1">
          <input
            type="email"
            className="input flex-1"
            style={{ fontSize: 12 }}
            placeholder="jugador@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            className="btn btn-ghost text-xs"
            onClick={saveEmail}
            disabled={savingEmail || email === (player.email ?? "")}
          >
            ✓
          </button>
        </div>
        {emailMsg && (
          <div
            style={{
              fontSize: 10,
              marginTop: 4,
              color: emailMsg.startsWith("✓")
                ? "var(--fm-fut-green)"
                : "var(--fm-danger)",
            }}
          >
            {emailMsg}
          </div>
        )}
      </div>
    </div>
  );
}
