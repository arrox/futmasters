import { useState } from "react";
import type { SorteoResponse, VerifyResponse } from "../api/client";
import { api } from "../api/client";

interface Props {
  sorteo: SorteoResponse;
}

export default function IntegrityPanel({ sorteo }: Props) {
  const [verify, setVerify] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showBombos, setShowBombos] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const v = await api.verify(sorteo.sorteo_id);
      setVerify(v);
    } catch (e) {
      setVerify({
        sorteo_id: sorteo.sorteo_id,
        verified: false,
        stored_hash: sorteo.hash,
        computed_hash: String((e as Error).message),
      });
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const clubs = sorteo.pool.filter((t) => t.type === "club").length;
  const nations = sorteo.pool.filter((t) => t.type === "nation").length;

  return (
    <aside className="card space-y-3">
      <h2 className="text-lg font-semibold">Integridad</h2>
      <dl className="text-sm space-y-2">
        <div>
          <dt className="text-slate-400 text-xs">Sorteo ID</dt>
          <dd className="mono text-xs break-all">{sorteo.sorteo_id}</dd>
        </div>
        <div>
          <dt className="text-slate-400 text-xs">Timestamp (UTC)</dt>
          <dd className="mono text-xs">{sorteo.timestamp}</dd>
        </div>
        <div>
          <dt className="text-slate-400 text-xs">Modo</dt>
          <dd className="mono text-xs">{sorteo.mode}</dd>
        </div>
        <div>
          <dt className="text-slate-400 text-xs">Aleatoriedad</dt>
          <dd className="mono text-xs">
            {sorteo.seed === null
              ? "CSPRNG (secrets.SystemRandom)"
              : `seed = ${sorteo.seed}`}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400 text-xs">Pool usado</dt>
          <dd className="text-xs">
            {clubs} clubes · {nations} selecciones
          </dd>
        </div>
        <div>
          <dt className="text-slate-400 text-xs">
            Composición de bombos{" "}
            <button
              className="text-accent text-xs underline"
              onClick={() => setShowBombos((s) => !s)}
            >
              {showBombos ? "ocultar" : "mostrar"}
            </button>
          </dt>
          {showBombos && (
            <dd className="text-xs mt-1 space-y-1">
              {sorteo.bombos.map((b) => (
                <div key={b.numero}>
                  <span className="text-slate-400">B{b.numero}:</span>{" "}
                  {b.equipos.map((e) => e.name).join(", ")}
                </div>
              ))}
            </dd>
          )}
        </div>
        <div>
          <dt className="text-slate-400 text-xs flex items-center justify-between">
            <span>Hash SHA-256</span>
            <button
              className="text-accent text-xs"
              onClick={() => copy(sorteo.hash)}
            >
              {copied ? "✓ copiado" : "copiar"}
            </button>
          </dt>
          <dd
            className="mono text-[10px] break-all bg-bg/60 border border-soft/60 rounded p-2 cursor-pointer"
            onClick={() => copy(sorteo.hash)}
          >
            {sorteo.hash}
          </dd>
        </div>
      </dl>
      <button
        className="btn btn-primary w-full"
        onClick={run}
        disabled={loading}
      >
        {loading ? "Verificando…" : "Verificar integridad"}
      </button>
      {verify && (
        <div
          className={`text-sm p-3 rounded border ${
            verify.verified
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-coral/40 bg-coral/10 text-coral"
          }`}
        >
          {verify.verified ? (
            <p>✓ Hash válido — el sorteo no fue modificado.</p>
          ) : (
            <div className="space-y-1">
              <p>✗ Hash NO coincide — el payload fue modificado.</p>
              <p className="mono text-[10px] break-all opacity-80">
                almacenado: {verify.stored_hash}
              </p>
              <p className="mono text-[10px] break-all opacity-80">
                computado: {verify.computed_hash}
              </p>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
