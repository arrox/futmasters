import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { SorteoResponse } from "../api/client";
import { api } from "../api/client";
import DrawAnimation from "../components/DrawAnimation";
import ResultTable from "../components/ResultTable";
import GroupsTable from "../components/GroupsTable";
import IntegrityPanel from "../components/IntegrityPanel";

export default function Resultado() {
  const { id } = useParams<{ id: string }>();
  const [sorteo, setSorteo] = useState<SorteoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealedUpTo, setRevealedUpTo] = useState(0);
  const [animating, setAnimating] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .getSorteo(id)
      .then((s) => {
        setSorteo(s);
        setRevealedUpTo(0);
        setAnimating(true);
      })
      .catch((e) => setError((e as Error).message));
  }, [id]);

  const onDone = useCallback(() => {
    if (sorteo) setRevealedUpTo(sorteo.assignments.length);
    setAnimating(false);
  }, [sorteo]);

  function skip() {
    if (sorteo) setRevealedUpTo(sorteo.assignments.length);
    setAnimating(false);
  }

  function shareLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
    });
  }

  if (error)
    return (
      <div className="card text-coral">
        <p>Error: {error}</p>
        <Link to="/" className="text-accent underline">
          Volver
        </Link>
      </div>
    );
  if (!sorteo) return <div className="card">Cargando…</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="md:col-span-3 space-y-6">
        {animating ? (
          <>
            <DrawAnimation
              bombos={sorteo.bombos}
              assignments={sorteo.assignments}
              onRevealUpdate={setRevealedUpTo}
              onDone={onDone}
            />
            <button className="btn btn-ghost" onClick={skip}>
              Saltar animación
            </button>
          </>
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h1 className="text-2xl font-bold">Resultado del sorteo</h1>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-ghost text-sm"
                onClick={() => api.downloadExport(sorteo, "csv")}
              >
                Exportar CSV
              </button>
              <button
                type="button"
                className="btn btn-ghost text-sm"
                onClick={() => api.downloadExport(sorteo, "json")}
              >
                Exportar JSON
              </button>
              <button
                type="button"
                className="btn btn-ghost text-sm"
                onClick={() => api.downloadExport(sorteo, "md")}
              >
                Exportar MD
              </button>
              <button className="btn btn-ghost text-sm" onClick={shareLink}>
                {copiedLink ? "✓ Enlace copiado" : "Compartir enlace"}
              </button>
              <Link
                to={`/admin?from=${sorteo.sorteo_id}`}
                className="btn btn-primary text-sm"
              >
                🏆 Crear torneo
              </Link>
              <Link to="/" className="btn btn-ghost text-sm">
                Nuevo sorteo
              </Link>
            </div>
          </div>
        )}
        <ResultTable
          assignments={sorteo.assignments}
          pool={sorteo.pool}
          revealedUpTo={revealedUpTo}
        />
        {!animating && sorteo.groups && <GroupsTable groups={sorteo.groups} />}
        {sorteo.warnings.length > 0 && (
          <div className="card text-sm text-slate-300 border-coral/40">
            <strong className="text-coral">Avisos:</strong>
            <ul className="list-disc pl-5 mt-1">
              {sorteo.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="md:col-span-1">
        <IntegrityPanel sorteo={sorteo} />
      </div>
    </div>
  );
}
