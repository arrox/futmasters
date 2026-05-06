import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type {
  Registration,
  SorteoListItem,
  Tournament,
  TournamentFormat,
} from "../api/client";
import { adminToken, api } from "../api/client";

type Tab = "registrations" | "tournaments" | "sorteos";

export default function AdminHome() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [sorteos, setSorteos] = useState<SorteoListItem[]>([]);
  const [regs, setRegs] = useState<Registration[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [waStatus, setWaStatus] = useState<{
    configured: boolean;
    recipients_count: number;
  } | null>(null);
  const [waSending, setWaSending] = useState(false);
  const [waMsg, setWaMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("registrations");
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const [ts, s, r, wa] = await Promise.all([
        api.listTournaments(),
        api.listSorteos(50, 0),
        api.adminListRegistrations(),
        api.whatsappStatus().catch(() => null),
      ]);
      setTournaments(ts);
      setSorteos(s.items);
      setRegs(r);
      setWaStatus(wa);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function testWhatsApp() {
    setWaSending(true);
    setWaMsg(null);
    try {
      const r = await api.whatsappTest();
      setWaMsg(r.sent ? `✓ ${r.detail}` : `✗ ${r.detail}`);
      setTimeout(() => setWaMsg(null), 6000);
    } catch (e) {
      setWaMsg(`✗ ${(e as Error).message}`);
    } finally {
      setWaSending(false);
    }
  }

  const pending = useMemo(() => regs.filter((r) => r.status === "pending"), [regs]);
  const used = useMemo(() => regs.filter((r) => r.status === "used"), [regs]);
  const activeTournaments = useMemo(
    () => tournaments.filter((t) => t.status !== "finished"),
    [tournaments],
  );

  function sortearConInscriptos() {
    if (pending.length < 2) {
      alert("Se necesitan al menos 2 inscritos pendientes.");
      return;
    }
    sessionStorage.setItem(
      "fc26_prefill_regs",
      JSON.stringify(pending.map((r) => ({ name: r.name, email: r.email }))),
    );
    nav("/admin/sorteo");
  }

  async function removeReg(id: number) {
    if (!confirm("¿Eliminar a este inscrito?")) return;
    try {
      await api.adminDeleteRegistration(id);
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function logout() {
    adminToken.clear();
    nav("/admin/login");
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar el torneo y todos sus datos?")) return;
    try {
      await api.deleteTournament(id);
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="admin-shell">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-header__title">
          <div className="fm-eyebrow">Panel de control</div>
          <h1 className="admin-header__h1">Admin · FC 26</h1>
        </div>
        <div className="admin-header__actions">
          <button className="btn btn-ghost" onClick={load} disabled={loading}>
            {loading ? "…" : "↻ Refrescar"}
          </button>
          <button className="btn btn-ghost" onClick={logout}>
            Salir
          </button>
        </div>
      </header>

      {/* Stats tiles */}
      <section className="stat-grid">
        <StatTile
          label="Inscritos pendientes"
          value={pending.length}
          hint={`${used.length} ya asignados`}
          intent={pending.length >= 2 ? "success" : "neutral"}
          icon="👥"
        />
        <StatTile
          label="Sorteos realizados"
          value={sorteos.length}
          hint={sorteos[0]?.timestamp.slice(0, 10) ?? "—"}
          intent="neutral"
          icon="🎲"
        />
        <StatTile
          label="Torneos activos"
          value={activeTournaments.length}
          hint={`${tournaments.length} en total`}
          intent={activeTournaments.length > 0 ? "primary" : "neutral"}
          icon="🏆"
        />
        <StatTile
          label="WhatsApp"
          value={waStatus?.configured ? waStatus.recipients_count : "—"}
          hint={waStatus?.configured ? "destinatarios activos" : "no configurado"}
          intent={waStatus?.configured ? "success" : "warning"}
          icon="💬"
        />
      </section>

      {/* Quick actions */}
      <section className="admin-actions">
        <button
          className="btn btn-green"
          onClick={sortearConInscriptos}
          disabled={pending.length < 2}
          title={
            pending.length < 2
              ? "Se necesitan al menos 2 inscritos para sortear."
              : undefined
          }
        >
          🎲 Sortear con {pending.length} inscrito{pending.length === 1 ? "" : "s"}
        </button>
        <Link to="/admin/sorteo" className="btn btn-ghost">
          ✎ Sortear manualmente
        </Link>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreate(true)}
          disabled={sorteos.length === 0}
          title={sorteos.length === 0 ? "Primero ejecutá un sorteo" : undefined}
        >
          + Nuevo torneo
        </button>
        {waStatus && (
          <button
            className="btn btn-ghost"
            onClick={testWhatsApp}
            disabled={waSending || !waStatus.configured}
          >
            {waSending ? "Probando…" : "💬 Test WhatsApp"}
          </button>
        )}
      </section>

      {waMsg && (
        <div
          className={`admin-banner ${
            waMsg.startsWith("✓") ? "admin-banner--ok" : "admin-banner--err"
          }`}
        >
          {waMsg}
        </div>
      )}
      {err && <div className="admin-banner admin-banner--err">{err}</div>}

      {/* Tabs */}
      <div className="admin-tabs">
        <TabButton
          active={tab === "registrations"}
          onClick={() => setTab("registrations")}
          label="Inscritos"
          badge={pending.length || undefined}
        />
        <TabButton
          active={tab === "tournaments"}
          onClick={() => setTab("tournaments")}
          label="Torneos"
          badge={tournaments.length || undefined}
        />
        <TabButton
          active={tab === "sorteos"}
          onClick={() => setTab("sorteos")}
          label="Sorteos"
          badge={sorteos.length || undefined}
        />
      </div>

      {/* Content */}
      {tab === "registrations" && (
        <RegistrationsPanel regs={regs} onRemove={removeReg} />
      )}
      {tab === "tournaments" && (
        <TournamentsPanel
          tournaments={tournaments}
          sorteosAvailable={sorteos.length > 0}
          onRemove={remove}
          onCreate={() => setShowCreate(true)}
        />
      )}
      {tab === "sorteos" && <SorteosPanel sorteos={sorteos} />}

      {/* WhatsApp detail if missing config */}
      {waStatus && !waStatus.configured && (
        <section className="fm-surface" style={{ marginTop: 16 }}>
          <div className="fm-eyebrow">Notificaciones</div>
          <h2 className="fm-h2" style={{ marginTop: 4 }}>
            WhatsApp no configurado
          </h2>
          <p
            className="text-xs mt-2"
            style={{ color: "var(--fm-ink-muted)", lineHeight: 1.6 }}
          >
            Definí las variables{" "}
            <code className="mono">TWILIO_ACCOUNT_SID</code>,{" "}
            <code className="mono">TWILIO_AUTH_TOKEN</code>,{" "}
            <code className="mono">TWILIO_FROM</code> y{" "}
            <code className="mono">WHATSAPP_RECIPIENTS</code> en{" "}
            <code>backend/.env.local</code> y reiniciá el servicio.
          </p>
        </section>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateTournamentModal
          sorteos={sorteos}
          onCancel={() => setShowCreate(false)}
          onCreated={(t) => {
            setShowCreate(false);
            nav(`/admin/tournaments/${t.id}`);
          }}
        />
      )}
    </div>
  );
}

// ---------- Reusable pieces ----------

function StatTile({
  label,
  value,
  hint,
  intent,
  icon,
}: {
  label: string;
  value: number | string;
  hint: string;
  intent: "success" | "primary" | "warning" | "neutral";
  icon: string;
}) {
  return (
    <div className={`stat-tile stat-tile--${intent}`}>
      <div className="stat-tile__icon" aria-hidden>
        {icon}
      </div>
      <div className="stat-tile__body">
        <div className="stat-tile__label">{label}</div>
        <div className="stat-tile__value">{value}</div>
        <div className="stat-tile__hint">{hint}</div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      className={`admin-tab ${active ? "admin-tab--active" : ""}`}
      onClick={onClick}
    >
      <span>{label}</span>
      {badge !== undefined && <span className="admin-tab__badge">{badge}</span>}
    </button>
  );
}

function RegistrationsPanel({
  regs,
  onRemove,
}: {
  regs: Registration[];
  onRemove: (id: number) => void;
}) {
  if (regs.length === 0) {
    return (
      <EmptyState
        emoji="📝"
        title="Sin inscritos todavía"
        body={
          <>
            Compartí el link público de inscripción en <code>/</code>. Cuando
            alguien se registre, va a aparecer acá.
          </>
        }
      />
    );
  }
  return (
    <div className="admin-list">
      {regs.map((r) => (
        <div key={r.id} className="admin-list__row">
          <div className="admin-list__main">
            <div className="admin-list__title">
              {r.name}
              {r.status === "used" && (
                <span className="chip chip--green">usado</span>
              )}
              {r.status === "removed" && (
                <span className="chip" style={{ opacity: 0.6 }}>
                  eliminado
                </span>
              )}
            </div>
            <div className="admin-list__sub mono">{r.email}</div>
          </div>
          <div className="admin-list__meta mono">
            {r.created_at.slice(0, 16).replace("T", " ")}
          </div>
          {r.status === "pending" && (
            <button
              className="btn btn-ghost text-xs"
              style={{ color: "var(--fm-danger)" }}
              onClick={() => onRemove(r.id)}
              aria-label={`Eliminar a ${r.name}`}
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function TournamentsPanel({
  tournaments,
  sorteosAvailable,
  onRemove,
  onCreate,
}: {
  tournaments: Tournament[];
  sorteosAvailable: boolean;
  onRemove: (id: string) => void;
  onCreate: () => void;
}) {
  if (tournaments.length === 0) {
    return (
      <EmptyState
        emoji="🏆"
        title="Aún no hay torneos"
        body={
          sorteosAvailable
            ? "Creá un torneo a partir de un sorteo existente."
            : "Primero ejecutá un sorteo y después convertilo en torneo."
        }
        action={
          sorteosAvailable ? (
            <button className="btn btn-primary" onClick={onCreate}>
              + Nuevo torneo
            </button>
          ) : undefined
        }
      />
    );
  }
  return (
    <div className="admin-list">
      {tournaments.map((t) => (
        <div key={t.id} className="admin-list__row">
          <div className="admin-list__main">
            <Link
              to={`/admin/tournaments/${t.id}`}
              className="admin-list__title admin-list__title--link"
            >
              {t.name}
            </Link>
            <div className="admin-list__sub">
              <span className={`chip chip--${statusChip(t.status)}`}>
                {statusLabel(t.status)}
              </span>
              <span>{formatLabel(t.format)}</span>
              <span className="mono">{t.created_at.slice(0, 10)}</span>
            </div>
          </div>
          <Link to={`/t/${t.id}`} className="btn btn-ghost text-xs">
            Ver público ↗
          </Link>
          <button
            className="btn btn-ghost text-xs"
            style={{ color: "var(--fm-danger)" }}
            onClick={() => onRemove(t.id)}
            aria-label={`Eliminar ${t.name}`}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

function SorteosPanel({ sorteos }: { sorteos: SorteoListItem[] }) {
  if (sorteos.length === 0) {
    return (
      <EmptyState
        emoji="🎲"
        title="Sin sorteos"
        body="Cuando ejecutes un sorteo vas a ver acá el historial."
      />
    );
  }
  return (
    <div className="admin-list">
      {sorteos.map((s) => (
        <Link
          key={s.id}
          to={`/resultado/${s.id}`}
          className="admin-list__row admin-list__row--linkable"
        >
          <div className="admin-list__main">
            <div className="admin-list__title">
              {s.mode}{" "}
              <span className="chip" style={{ marginLeft: 6 }}>
                N={s.num_participants}
              </span>
              {s.seed !== null && (
                <span className="chip" style={{ marginLeft: 6 }}>
                  seed {s.seed}
                </span>
              )}
            </div>
            <div className="admin-list__sub mono text-xs">
              {s.hash.slice(0, 16)}…
            </div>
          </div>
          <div className="admin-list__meta mono">
            {s.timestamp.slice(0, 16).replace("T", " ")}
          </div>
        </Link>
      ))}
    </div>
  );
}

function EmptyState({
  emoji,
  title,
  body,
  action,
}: {
  emoji: string;
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__emoji">{emoji}</div>
      <h3 className="empty-state__title">{title}</h3>
      <p className="empty-state__body">{body}</p>
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}

function CreateTournamentModal({
  sorteos,
  onCancel,
  onCreated,
}: {
  sorteos: SorteoListItem[];
  onCancel: () => void;
  onCreated: (t: Tournament) => void;
}) {
  const [name, setName] = useState("");
  const [sorteoId, setSorteoId] = useState(sorteos[0]?.id ?? "");
  const [format, setFormat] = useState<TournamentFormat>("groups_knockout");
  const [numGroups, setNumGroups] = useState(4);
  const [qualify, setQualify] = useState(2);
  const [doubleRound, setDoubleRound] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = sorteos.find((s) => s.id === sorteoId);

  async function submit() {
    setErr(null);
    setSaving(true);
    try {
      const t = await api.createTournament({
        name,
        sorteo_id: sorteoId,
        format,
        num_groups: numGroups,
        qualify_per_group: qualify,
        double_round: doubleRound,
      });
      onCreated(t);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="modal-panel">
        <div className="modal-panel__header">
          <div>
            <div className="fm-eyebrow">Crear</div>
            <h2 className="fm-h2" style={{ marginTop: 4 }}>
              Nuevo torneo
            </h2>
          </div>
          <button
            className="btn btn-ghost text-sm"
            onClick={onCancel}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="modal-panel__body">
          <div className="form-field">
            <label>Nombre</label>
            <input
              className="input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Copa FutMasters 2026"
              autoFocus
            />
          </div>
          <div className="form-field">
            <label>Sorteo base</label>
            <select
              className="input w-full"
              value={sorteoId}
              onChange={(e) => setSorteoId(e.target.value)}
            >
              {sorteos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.timestamp.slice(0, 10)} — {s.num_participants} jugadores — {s.mode}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Formato</label>
            <select
              className="input w-full"
              value={format}
              onChange={(e) => setFormat(e.target.value as TournamentFormat)}
            >
              <option value="groups_knockout">Grupos + eliminación directa</option>
              <option value="knockout">Eliminación directa (bracket)</option>
              <option value="league">Liga (todos contra todos)</option>
            </select>
          </div>
          {format === "knockout" && selected && (
            <p
              className="form-hint"
              style={{
                color: isPowerOf2(selected.num_participants)
                  ? "var(--fm-ink-muted)"
                  : "var(--fm-danger)",
              }}
            >
              {selected.num_participants} participantes —{" "}
              {isPowerOf2(selected.num_participants)
                ? "✓ bracket válido"
                : "✗ no es potencia de 2 (usá 2, 4, 8 o 16)"}
            </p>
          )}
          {format === "groups_knockout" && (
            <div className="form-grid">
              <div className="form-field">
                <label>Nº grupos</label>
                <input
                  type="number"
                  className="input w-full"
                  min={1}
                  max={8}
                  value={numGroups}
                  onChange={(e) => setNumGroups(Number(e.target.value))}
                />
              </div>
              <div className="form-field">
                <label>Clasifican por grupo</label>
                <input
                  type="number"
                  className="input w-full"
                  min={1}
                  max={8}
                  value={qualify}
                  onChange={(e) => setQualify(Number(e.target.value))}
                />
              </div>
              {selected && (
                <p className="form-hint" style={{ gridColumn: "1 / -1" }}>
                  {selected.num_participants} jugadores →{" "}
                  {selected.num_participants / numGroups} por grupo, {numGroups *
                    qualify}{" "}
                  clasificados (debe ser 2, 4, 8 o 16).
                </p>
              )}
            </div>
          )}
          <label className="form-check">
            <input
              type="checkbox"
              checked={doubleRound}
              onChange={(e) => setDoubleRound(e.target.checked)}
            />
            Ida y vuelta en fase de grupos
          </label>
          {err && <p className="text-coral text-sm">{err}</p>}
        </div>
        <div className="modal-panel__footer">
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={!name || !sorteoId || saving}
          >
            {saving ? "Creando…" : "Crear torneo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Helpers ----------

export function statusLabel(s: string): string {
  return (
    {
      draft: "Borrador",
      groups: "Fase de grupos",
      knockout: "Eliminatoria",
      finished: "Finalizado",
    } as Record<string, string>
  )[s] ?? s;
}

function statusChip(s: string): string {
  return (
    {
      draft: "",
      groups: "totw",
      knockout: "icon",
      finished: "green",
    } as Record<string, string>
  )[s] ?? "";
}

export function formatLabel(f: string): string {
  return (
    {
      groups_knockout: "Grupos + eliminación",
      knockout: "Eliminación directa",
      league: "Liga",
    } as Record<string, string>
  )[f] ?? f;
}

function isPowerOf2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}
