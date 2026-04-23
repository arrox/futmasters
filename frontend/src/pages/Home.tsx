import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Tournament } from "../api/client";
import { api } from "../api/client";

export default function Home() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState<number>(0);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  useEffect(() => {
    let mounted = true;
    api.registrationCount().then((r) => mounted && setPending(r.pending));
    api.listTournaments().then((t) => mounted && setTournaments(t));
    return () => {
      mounted = false;
    };
  }, []);

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      await api.registerPublic(name.trim(), email.trim());
      setDone(true);
      setPending((p) => p + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const liveTournaments = tournaments.filter((t) => t.status !== "draft");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* HERO + registro */}
      <section className="fm-surface relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(circle at 20% 15%, rgba(240,196,96,0.25), transparent 40%), radial-gradient(circle at 80% 85%, rgba(110,197,255,0.18), transparent 45%)",
          }}
        />
        <div className="relative">
          <div className="fm-eyebrow">Kick off</div>
          <h1 className="fm-h1 mt-1" style={{ fontSize: 44, lineHeight: 1 }}>
            Inscribite al{" "}
            <span className="fm-gold-metal-text">sorteo FC 26</span>
          </h1>
          <p
            className="mt-4"
            style={{
              color: "var(--fm-ink-muted)",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            Dejanos tu nombre y email. Cuando el admin ejecute el sorteo, te
            mandamos un email con el equipo que te tocó y las instrucciones para
            entrar al torneo.
          </p>

          {done ? (
            <div
              className="mt-5 p-4 rounded"
              style={{
                border: "1px solid rgba(0,255,135,0.35)",
                background: "rgba(0,255,135,0.06)",
              }}
            >
              <div
                className="fm-display"
                style={{
                  color: "var(--fm-fut-green)",
                  fontSize: 20,
                }}
              >
                ✓ Inscripto
              </div>
              <p
                className="mt-2"
                style={{
                  color: "var(--fm-ink-muted)",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                Te mandamos un email cuando el sorteo esté hecho. Revisá la
                casilla de entrada (y spam) de <span className="mono">{email}</span>.
              </p>
              <button
                className="btn btn-ghost mt-3"
                onClick={() => {
                  setDone(false);
                  setName("");
                  setEmail("");
                }}
              >
                Inscribir a otro
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              <div>
                <label
                  className="fm-eyebrow block mb-1"
                  style={{ fontSize: 10 }}
                >
                  Tu nombre
                </label>
                <input
                  className="input w-full"
                  placeholder="Juan Pérez"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div>
                <label
                  className="fm-eyebrow block mb-1"
                  style={{ fontSize: 10 }}
                >
                  Tu email
                </label>
                <input
                  type="email"
                  className="input w-full"
                  placeholder="vos@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  disabled={saving}
                />
              </div>
              {error && (
                <p style={{ color: "var(--fm-danger)", fontSize: 12 }}>
                  {error}
                </p>
              )}
              <button
                className="btn btn-primary w-full"
                style={{ padding: "14px" }}
                disabled={!name.trim() || !email.trim() || saving}
                onClick={submit}
              >
                {saving ? "Inscribiendo…" : "🏆 Inscribirme"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Side: stats + torneos activos */}
      <section className="space-y-4">
        <div className="fm-surface">
          <div className="fm-eyebrow">Standings</div>
          <h2 className="fm-h2 mt-1">Estado</h2>
          <div
            className="fm-display mt-3"
            style={{
              fontSize: 54,
              color: "var(--fm-gold)",
              lineHeight: 1,
            }}
          >
            {pending}
          </div>
          <div
            className="fm-eyebrow mt-1"
            style={{ fontSize: 11 }}
          >
            inscriptos esperando el sorteo
          </div>
        </div>

        {liveTournaments.length > 0 && (
          <div className="fm-surface">
            <div className="fm-eyebrow">Live</div>
            <h2 className="fm-h2 mt-1">Torneos en curso</h2>
            <ul className="mt-3 space-y-2">
              {liveTournaments.slice(0, 5).map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between"
                  style={{
                    border: "1px solid rgba(240,196,96,0.15)",
                    background: "rgba(5,7,12,0.5)",
                    borderRadius: 6,
                    padding: "8px 12px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--fm-font-sans)",
                      fontWeight: 500,
                    }}
                  >
                    {t.name}
                  </span>
                  <Link
                    to={`/t/${t.id}`}
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: "4px 10px" }}
                  >
                    Ver
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="fm-surface">
          <div className="fm-eyebrow">¿Cómo funciona?</div>
          <ol
            className="mt-3 space-y-2"
            style={{
              color: "var(--fm-ink-muted)",
              fontSize: 13,
              lineHeight: 1.5,
              listStyle: "decimal",
              paddingLeft: 18,
            }}
          >
            <li>Te inscribís acá con nombre + email.</li>
            <li>
              El <b>admin</b> cierra las inscripciones y ejecuta el sorteo.
            </li>
            <li>
              Te llega un email con tu equipo asignado (Real Madrid, Man City,
              etc.) y el link al torneo.
            </li>
            <li>
              Para entrar al sistema, Cloudflare te manda un código de 6
              dígitos a tu email.
            </li>
            <li>
              ¿No te gusta tu equipo? Podés proponer intercambios con otros
              inscriptos. Los dos confirman por email, y el admin autoriza.
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}
