import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ParticipantList, {
  ParticipantEntry,
} from "../components/ParticipantList";
import BombosPreview from "../components/BombosPreview";
import ModeSelector from "../components/ModeSelector";
import type { Mode, PoolResponse } from "../api/client";
import { adminToken, api } from "../api/client";

export default function NewSorteo() {
  const [participants, setParticipants] = useState<ParticipantEntry[]>([]);
  const [mode, setMode] = useState<Mode>("simple");
  const [seedText, setSeedText] = useState("");
  const [pool, setPool] = useState<PoolResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [adminRequired, setAdminRequired] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(adminToken.get() !== null);
  const nav = useNavigate();

  useEffect(() => {
    api
      .adminStatus()
      .then((s) => {
        setAdminRequired(s.configured);
        if (!s.configured) setIsAdmin(true); // dev mode
      })
      .catch(() => setAdminRequired(false));
  }, []);

  useEffect(() => {
    if (participants.length < 2) {
      setPool(null);
      return;
    }
    let cancelled = false;
    api
      .pool(participants.length)
      .then((p) => {
        if (cancelled) return;
        setPool(p);
        // Si el modo actual ya no está disponible, cambiar a simple.
        if (!p.available_modes.includes(mode)) setMode("simple");
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [participants.length, mode]);

  function validSeed(): number | null {
    const t = seedText.trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isInteger(n) || n < 0 || n > Number.MAX_SAFE_INTEGER) {
      throw new Error("La semilla debe ser un entero no negativo.");
    }
    return n;
  }

  async function sortear() {
    setError(null);
    let seed: number | null;
    try {
      seed = validSeed();
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setLoading(true);
    try {
      const res = await api.sortear({ participants, mode, seed });
      nav(`/resultado/${res.sorteo_id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const enoughParticipants = participants.length >= 2;

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
      <section className="md:col-span-2 space-y-6">
        <ParticipantList
          participants={participants}
          setParticipants={setParticipants}
        />
        <div className="card">
          <h2 className="text-lg font-semibold mb-2">Reproducibilidad</h2>
          <p className="text-xs text-slate-400 mb-3">
            Dejá vacío para usar CSPRNG (secreto). Para sorteos públicos
            anuncien la semilla antes del sorteo y cualquiera puede
            reproducirlo.
          </p>
          <input
            className="input w-full"
            placeholder="Semilla opcional (entero)"
            value={seedText}
            onChange={(e) => setSeedText(e.target.value)}
            inputMode="numeric"
          />
        </div>
        {!isAdmin && adminRequired ? (
          <div className="fm-surface" style={{ textAlign: "center" }}>
            <div className="fm-eyebrow">Admin only</div>
            <p
              className="mt-2 text-sm"
              style={{ color: "var(--fm-ink-muted)", lineHeight: 1.6 }}
            >
              Solo el admin puede ejecutar un sorteo. Ingresá con tu password
              para continuar.
            </p>
            <Link to="/admin/login" className="btn btn-primary mt-3">
              Ingresar como admin
            </Link>
          </div>
        ) : (
          <button
            className="btn btn-primary w-full text-base py-3"
            disabled={!enoughParticipants || loading}
            onClick={sortear}
          >
            {loading ? "Sorteando…" : "🎲 Sortear"}
          </button>
        )}
        {error && (
          <div className="card text-coral text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}
      </section>
      <section className="md:col-span-3 space-y-6">
        {pool ? (
          <>
            <BombosPreview
              bombos={pool.bombos}
              clubsCount={pool.clubs_count}
              nationsCount={pool.nations_count}
              participants={pool.participants}
            />
            <ModeSelector
              value={mode}
              onChange={setMode}
              available={pool.available_modes}
              numBombos={pool.bombos.length}
              numParticipants={pool.participants}
            />
          </>
        ) : (
          <div className="card text-slate-400">
            <h2 className="text-lg font-semibold mb-2 text-slate-100">
              Preview del pool
            </h2>
            <p className="text-sm">
              Agregá al menos 2 participantes para ver el pool efectivo y los
              bombos propuestos.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
