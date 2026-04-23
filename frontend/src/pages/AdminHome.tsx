import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type {
  Registration,
  SorteoListItem,
  Tournament,
  TournamentFormat,
} from "../api/client";
import { adminToken, api } from "../api/client";

export default function AdminHome() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [sorteos, setSorteos] = useState<SorteoListItem[]>([]);
  const [regs, setRegs] = useState<Registration[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();

  async function load() {
    try {
      const [ts, s, r] = await Promise.all([
        api.listTournaments(),
        api.listSorteos(50, 0),
        api.adminListRegistrations(),
      ]);
      setTournaments(ts);
      setSorteos(s.items);
      setRegs(r);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const pending = regs.filter((r) => r.status === "pending");

  function sortearConInscriptos() {
    if (pending.length < 2) {
      alert("Necesitás al menos 2 inscriptos pendientes");
      return;
    }
    // Persistimos los IDs seleccionados en sessionStorage para que
    // /admin/sorteo los levante y precargue la lista.
    sessionStorage.setItem(
      "fc26_prefill_regs",
      JSON.stringify(pending.map((r) => ({ name: r.name, email: r.email }))),
    );
    nav("/admin/sorteo");
  }

  async function removeReg(id: number) {
    if (!confirm("¿Eliminar este inscripto?")) return;
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
    if (!confirm("¿Eliminar torneo y todos sus datos?")) return;
    try {
      await api.deleteTournament(id);
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="fm-eyebrow">Panel</div>
          <h1 className="fm-h1 mt-1" style={{ fontSize: 36 }}>
            Admin
          </h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            className="btn btn-green"
            onClick={sortearConInscriptos}
            disabled={pending.length < 2}
            title={
              pending.length < 2
                ? "Necesitás al menos 2 inscriptos para sortear"
                : undefined
            }
          >
            🎲 Sortear con {pending.length} inscripto{pending.length === 1 ? "" : "s"}
          </button>
          <Link to="/admin/sorteo" className="btn btn-ghost">
            Sortear manualmente
          </Link>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreate(true)}
            disabled={sorteos.length === 0}
          >
            + Nuevo torneo
          </button>
          <button className="btn btn-ghost" onClick={logout}>
            Salir
          </button>
        </div>
      </div>

      <div className="fm-surface">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="fm-eyebrow">Registrations</div>
            <h2 className="fm-h2 mt-1">Inscriptos</h2>
          </div>
          <span className="chip">
            {pending.length} pendiente{pending.length === 1 ? "" : "s"}
          </span>
        </div>
        {regs.length === 0 ? (
          <p
            className="text-sm"
            style={{ color: "var(--fm-ink-muted)" }}
          >
            Todavía no hay nadie inscripto. Cuando alguien se registre en{" "}
            <code>/</code> va a aparecer acá.
          </p>
        ) : (
          <ul className="divide-y divide-soft/30">
            {regs.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between py-2 gap-2"
              >
                <div className="min-w-0">
                  <div
                    style={{
                      fontFamily: "var(--fm-font-sans)",
                      fontWeight: 500,
                    }}
                  >
                    {r.name}{" "}
                    {r.status === "used" && (
                      <span className="chip chip--green" style={{ marginLeft: 6 }}>
                        usado
                      </span>
                    )}
                    {r.status === "removed" && (
                      <span
                        className="chip"
                        style={{
                          marginLeft: 6,
                          opacity: 0.6,
                        }}
                      >
                        eliminado
                      </span>
                    )}
                  </div>
                  <div
                    className="mono text-xs truncate"
                    style={{ color: "var(--fm-ink-muted)" }}
                  >
                    {r.email}
                  </div>
                </div>
                <div className="mono text-xs" style={{ color: "var(--fm-ink-dim)" }}>
                  {r.created_at.slice(0, 16).replace("T", " ")}
                </div>
                {r.status === "pending" && (
                  <button
                    className="btn btn-ghost text-xs text-coral"
                    onClick={() => removeReg(r.id)}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {err && <p className="text-coral text-sm">{err}</p>}

      {showCreate && (
        <CreateTournamentForm
          sorteos={sorteos}
          onCancel={() => setShowCreate(false)}
          onCreated={(t) => {
            setShowCreate(false);
            nav(`/admin/tournaments/${t.id}`);
          }}
        />
      )}

      <div className="card">
        <h2 className="text-lg font-semibold mb-3">Torneos</h2>
        {tournaments.length === 0 ? (
          <p className="text-slate-400 text-sm">
            Todavía no hay torneos.{" "}
            {sorteos.length === 0
              ? "Primero hacé un sorteo en la página principal."
              : "Creá uno desde un sorteo existente."}
          </p>
        ) : (
          <ul className="divide-y divide-soft/30">
            {tournaments.map((t) => (
              <li
                key={t.id}
                className="py-2 flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/admin/tournaments/${t.id}`}
                    className="font-medium hover:text-accent"
                  >
                    {t.name}
                  </Link>
                  <div className="text-xs text-slate-400 flex gap-3 flex-wrap">
                    <span className="chip">{statusLabel(t.status)}</span>
                    <span>{formatLabel(t.format)}</span>
                    <span className="mono">{t.created_at.slice(0, 19)}</span>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <Link
                    to={`/t/${t.id}`}
                    className="btn btn-ghost text-xs"
                  >
                    Ver público
                  </Link>
                  <button
                    className="btn btn-ghost text-xs text-coral"
                    onClick={() => remove(t.id)}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CreateTournamentForm({
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
    <div className="card space-y-3">
      <h2 className="text-lg font-semibold">Crear torneo</h2>
      <div>
        <label className="text-xs text-slate-400 block mb-1">Nombre</label>
        <input
          className="input w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Copa FutMasters 2026"
        />
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-1">
          Sorteo base
        </label>
        <select
          className="input w-full"
          value={sorteoId}
          onChange={(e) => setSorteoId(e.target.value)}
        >
          {sorteos.map((s) => (
            <option key={s.id} value={s.id}>
              {s.timestamp.slice(0, 19)} — {s.num_participants} jugadores — {s.mode}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-1">Formato</label>
        <select
          className="input w-full"
          value={format}
          onChange={(e) => setFormat(e.target.value as TournamentFormat)}
        >
          <option value="groups_knockout">
            Grupos + eliminación directa (Champions/Mundial)
          </option>
          <option value="knockout">
            Eliminación directa (bracket puro, N potencia de 2)
          </option>
          <option value="league">Liga todos contra todos</option>
        </select>
      </div>
      {format === "knockout" && selected && (
        <p
          className="text-xs"
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Nº grupos
            </label>
            <input
              type="number"
              className="input w-full"
              min={1}
              max={8}
              value={numGroups}
              onChange={(e) => setNumGroups(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Clasifican por grupo
            </label>
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
            <div className="col-span-2 text-xs text-slate-400">
              {selected.num_participants} jugadores →{" "}
              {selected.num_participants / numGroups} por grupo (debe ser entero) →{" "}
              {numGroups * qualify} clasificados (debe ser potencia de 2: 2, 4, 8, 16).
            </div>
          )}
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={doubleRound}
          onChange={(e) => setDoubleRound(e.target.checked)}
        />
        Ida y vuelta en fase de grupos
      </label>
      {err && <p className="text-coral text-sm">{err}</p>}
      <div className="flex gap-2 justify-end">
        <button className="btn btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button
          className="btn btn-primary"
          onClick={submit}
          disabled={!name || !sorteoId || saving}
        >
          {saving ? "Creando…" : "Crear"}
        </button>
      </div>
    </div>
  );
}

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
