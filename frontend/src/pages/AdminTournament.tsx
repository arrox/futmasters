import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Player, TournamentDetail } from "../api/client";
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
    "jugadores" | "grupos" | "fixture" | "bracket"
  >("jugadores");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setData(await api.getTournament(id));
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
              {hasGroups ? "Re-sortear grupos" : "Sortear grupos"}
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
                  ? "Completá todos los partidos de grupo"
                  : undefined
              }
            >
              Sortear llaves
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-soft/40 overflow-x-auto">
        {(["jugadores", "grupos", "fixture", "bracket"] as const).map((x) => (
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

      {tab === "bracket" && (
        <div className="space-y-6">
          <BracketView matches={matches} players={players} />
          <FixtureList
            matches={matches.filter((m) =>
              ["round_of_16", "quarter", "semi", "final"].includes(m.stage),
            )}
            players={players}
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
    </div>
  );
}
