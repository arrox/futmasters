import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { SorteoListItem } from "../api/client";
import { api } from "../api/client";

export default function Historial() {
  const [items, setItems] = useState<SorteoListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const limit = 20;

  useEffect(() => {
    api
      .listSorteos(limit, offset)
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
      })
      .catch((e) => setError((e as Error).message));
  }, [offset]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Historial</h1>
        <span className="chip mono">{total} sorteos</span>
      </div>
      {error && <p className="text-coral text-sm">{error}</p>}
      {items.length === 0 ? (
        <p className="text-slate-400">Todavía no se hicieron sorteos.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-soft/60">
                <th className="py-2 pr-3">Fecha (UTC)</th>
                <th className="py-2 pr-3">Modo</th>
                <th className="py-2 pr-3">N</th>
                <th className="py-2 pr-3">Semilla</th>
                <th className="py-2">Hash</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-soft/20 hover:bg-accent/5 cursor-pointer"
                >
                  <td className="py-2 pr-3 mono text-xs">
                    <Link to={`/resultado/${s.id}`}>{s.timestamp}</Link>
                  </td>
                  <td className="py-2 pr-3">
                    <Link to={`/resultado/${s.id}`}>{s.mode}</Link>
                  </td>
                  <td className="py-2 pr-3 mono">{s.num_participants}</td>
                  <td className="py-2 pr-3 mono text-xs">
                    {s.seed ?? "—"}
                  </td>
                  <td className="py-2 mono text-[10px] text-slate-400">
                    <Link to={`/resultado/${s.id}`}>
                      {s.hash.slice(0, 12)}…
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex justify-between mt-4 text-sm">
        <button
          className="btn btn-ghost"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - limit))}
        >
          ← Anterior
        </button>
        <button
          className="btn btn-ghost"
          disabled={offset + limit >= total}
          onClick={() => setOffset(offset + limit)}
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
