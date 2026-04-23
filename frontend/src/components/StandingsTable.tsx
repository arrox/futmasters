import type { StandingRow } from "../api/client";
import { api } from "../api/client";

interface Props {
  standings: StandingRow[];
  qualifyPerGroup?: number;
  byGroup?: boolean;
}

export default function StandingsTable({
  standings,
  qualifyPerGroup = 0,
  byGroup = true,
}: Props) {
  if (standings.length === 0) {
    return <p className="text-slate-400 text-sm">Sin datos aún.</p>;
  }

  const groups = byGroup
    ? groupBy(standings, (s) => s.group_label ?? "—")
    : { all: standings };
  const labels = Object.keys(groups).sort();

  return (
    <div className="space-y-4">
      {labels.map((label) => (
        <div key={label} className="card">
          {byGroup && label !== "all" && (
            <h3 className="font-semibold mb-2 text-accent">
              Grupo {label === "—" ? "—" : label}
            </h3>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-soft/60 text-left text-xs uppercase tracking-wider">
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-3">Jugador</th>
                  <th className="py-1 pr-3">Equipo</th>
                  <th className="py-1 pr-2 text-center">PJ</th>
                  <th className="py-1 pr-2 text-center">PG</th>
                  <th className="py-1 pr-2 text-center">PE</th>
                  <th className="py-1 pr-2 text-center">PP</th>
                  <th className="py-1 pr-2 text-center">GF</th>
                  <th className="py-1 pr-2 text-center">GC</th>
                  <th className="py-1 pr-2 text-center">DIF</th>
                  <th className="py-1 text-center text-accent">PTS</th>
                </tr>
              </thead>
              <tbody>
                {groups[label].map((row, idx) => {
                  const qualifies =
                    byGroup &&
                    qualifyPerGroup > 0 &&
                    row.group_position <= qualifyPerGroup;
                  return (
                    <tr
                      key={row.player_id}
                      className={`border-b border-soft/20 transition-colors ${
                        qualifies ? "bg-accent/5" : ""
                      }`}
                    >
                      <td className="py-1.5 pr-2 mono text-slate-400">
                        {row.group_position || idx + 1}
                        {qualifies && <span className="text-accent">•</span>}
                      </td>
                      <td className="py-1.5 pr-3 flex items-center gap-2">
                        {row.photo_filename ? (
                          <img
                            src={api.mediaUrl(row.photo_filename)!}
                            className="w-7 h-7 rounded-full object-cover border border-soft/60"
                            alt=""
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-bg border border-soft/60" />
                        )}
                        <span className="font-medium">{row.display_name}</span>
                      </td>
                      <td className="py-1.5 pr-3 text-slate-300 text-xs">
                        {row.team_name}
                      </td>
                      <td className="py-1.5 pr-2 text-center mono">{row.pj}</td>
                      <td className="py-1.5 pr-2 text-center mono">{row.pg}</td>
                      <td className="py-1.5 pr-2 text-center mono">{row.pe}</td>
                      <td className="py-1.5 pr-2 text-center mono">{row.pp}</td>
                      <td className="py-1.5 pr-2 text-center mono">{row.gf}</td>
                      <td className="py-1.5 pr-2 text-center mono">{row.gc}</td>
                      <td
                        className={`py-1.5 pr-2 text-center mono ${
                          row.dif > 0 ? "text-accent" : row.dif < 0 ? "text-coral" : ""
                        }`}
                      >
                        {row.dif > 0 ? "+" : ""}
                        {row.dif}
                      </td>
                      <td className="py-1.5 text-center font-bold text-accent">
                        {row.pts}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
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
