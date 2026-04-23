import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Trade } from "../api/client";
import { api } from "../api/client";

export default function TradeConfirm() {
  const { token } = useParams<{ token: string }>();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  async function load() {
    if (!token) return;
    try {
      setTrade(await api.getTrade(token));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function onConfirm() {
    if (!token) return;
    setActing(true);
    setErr(null);
    try {
      setTrade(await api.confirmTrade(token));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setActing(false);
    }
  }

  async function onCancel() {
    if (!token) return;
    if (!window.confirm("¿Cancelar este intercambio?")) return;
    setActing(true);
    setErr(null);
    try {
      setTrade(await api.cancelTrade(token));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setActing(false);
    }
  }

  if (err && !trade) {
    return (
      <div className="fm-surface max-w-xl mx-auto">
        <div className="fm-eyebrow">Trade</div>
        <h1 className="fm-h1 mt-1" style={{ fontSize: 28 }}>
          Enlace inválido
        </h1>
        <p className="mt-3 text-sm" style={{ color: "var(--fm-ink-muted)" }}>
          {err}
        </p>
        <Link to="/" className="btn btn-ghost mt-4">
          Volver al inicio
        </Link>
      </div>
    );
  }
  if (!trade) return <div className="card">Cargando…</div>;

  const myTurn = trade.role === "proposer"
    ? !trade.proposer_confirmed_at
    : !trade.receiver_confirmed_at;
  const bothConfirmed = trade.status === "executed";
  const cancelled = trade.status === "cancelled" || trade.status === "expired";

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="fm-surface">
        <div className="fm-eyebrow">Intercambio</div>
        <h1 className="fm-h1 mt-1" style={{ fontSize: 32 }}>
          Confirma el cambio
        </h1>
        <p
          className="mt-2"
          style={{ color: "var(--fm-ink-muted)", fontSize: 13 }}
        >
          {trade.role === "proposer"
            ? "Estás viendo este enlace como quien propuso el intercambio."
            : "Estás viendo este enlace como quien recibe la propuesta."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TradeParty
          title="Da su equipo"
          player={trade.proposer}
          confirmed={!!trade.proposer_confirmed_at}
        />
        <TradeParty
          title="Da su equipo"
          player={trade.receiver}
          confirmed={!!trade.receiver_confirmed_at}
        />
      </div>

      <div className="fm-surface flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="fm-eyebrow">Estado</div>
          <h2
            className="fm-display mt-1"
            style={{
              fontSize: 22,
              color: bothConfirmed
                ? "var(--fm-fut-green)"
                : cancelled
                  ? "var(--fm-danger)"
                  : "var(--fm-gold)",
            }}
          >
            {statusLabel(trade.status)}
          </h2>
          {trade.executed_at && (
            <p className="mono text-xs mt-1" style={{ color: "var(--fm-ink-muted)" }}>
              Ejecutado: {new Date(trade.executed_at).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {myTurn && !cancelled && !bothConfirmed && (
            <button
              className="btn btn-primary"
              onClick={onConfirm}
              disabled={acting}
            >
              {acting ? "Confirmando…" : "✓ Confirmar"}
            </button>
          )}
          {!cancelled && !bothConfirmed && (
            <button
              className="btn btn-ghost"
              onClick={onCancel}
              disabled={acting}
            >
              Cancelar intercambio
            </button>
          )}
          <Link to="/" className="btn btn-ghost">
            Inicio
          </Link>
        </div>
      </div>

      {err && (
        <div className="fm-surface" style={{ color: "var(--fm-danger)" }}>
          {err}
        </div>
      )}

      {trade.status === "awaiting_admin" && (
        <div className="fm-surface">
          <p
            className="text-sm"
            style={{ color: "var(--fm-warning)", lineHeight: 1.6 }}
          >
            ✓ Ambos confirmaron. Falta que el administrador autorice el
            intercambio para que los equipos se cambien en el torneo.
          </p>
        </div>
      )}
      {bothConfirmed && (
        <div className="fm-surface">
          <p
            className="text-sm"
            style={{ color: "var(--fm-fut-green)", lineHeight: 1.6 }}
          >
            ✓ Intercambio ejecutado. Los equipos ya fueron cambiados en el
            torneo. Puedes verificar las nuevas asignaciones en la vista
            pública del campeonato.
          </p>
        </div>
      )}
    </div>
  );
}

function TradeParty({
  title,
  player,
  confirmed,
}: {
  title: string;
  player: Trade["proposer"];
  confirmed: boolean;
}) {
  return (
    <div className="fm-surface">
      <div className="flex justify-between items-start">
        <div className="fm-eyebrow">{title}</div>
        {confirmed ? (
          <span className="chip chip--green">✓ firmó</span>
        ) : (
          <span className="chip">pendiente</span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3">
        {player.photo_filename ? (
          <img
            src={api.mediaUrl(player.photo_filename)!}
            className="w-12 h-12 rounded-full object-cover border border-[rgba(240,196,96,0.35)]"
            alt=""
          />
        ) : (
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center font-display font-bold"
            style={{
              background: "var(--fm-gold-metal)",
              color: "#2a1e08",
            }}
          >
            {player.display_name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <div className="font-semibold">{player.display_name}</div>
          <div className="text-xs text-slate-400">
            {player.team_name} · OVR {player.team_ovr}
          </div>
        </div>
      </div>
    </div>
  );
}

function statusLabel(s: string): string {
  return (
    {
      pending: "Pendiente — faltan firmas",
      confirmed: "Firmado parcialmente",
      awaiting_admin: "Esperando autorización del administrador",
      executed: "Intercambio ejecutado",
      cancelled: "Cancelado",
      expired: "Expirado",
    } as Record<string, string>
  )[s] ?? s;
}
