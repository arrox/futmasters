import { useEffect, useMemo, useState } from "react";
import type { Assignment, BombosPreview } from "../api/client";

interface Props {
  bombos: BombosPreview[];
  assignments: Assignment[];
  onRevealUpdate: (upTo: number) => void;
  onDone: () => void;
}

const STEP_MS = 550;

/**
 * Pack reveal — bombos como "packs" que se van abriendo.
 * Cada equipo "sale" con flash + walkout animation (motion spec del design system).
 */
export default function DrawAnimation({
  bombos,
  assignments,
  onRevealUpdate,
  onDone,
}: Props) {
  // Orden de reveal: primero por bombo, luego por pick_order dentro del bombo.
  const reveal = useMemo(
    () =>
      [...assignments].sort(
        (a, b) => a.bombo - b.bombo || a.pick_order - b.pick_order,
      ),
    [assignments],
  );
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= reveal.length) {
      onDone();
      return;
    }
    const t = setTimeout(() => {
      const current = reveal[step];
      onRevealUpdate(Math.max(current.pick_order, step + 1));
      setStep((s) => s + 1);
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [step, reveal, onRevealUpdate, onDone]);

  const caidos = new Set(reveal.slice(0, step).map((a) => a.team));
  const currentBombo =
    step < reveal.length ? reveal[step].bombo : bombos.length;
  const progress = Math.round((step / Math.max(1, reveal.length)) * 100);

  return (
    <div
      className="fm-surface relative overflow-hidden"
      style={{ padding: 24 }}
    >
      {/* rays background */}
      <div
        className="fm-rays"
        style={{ opacity: step < reveal.length ? 0.7 : 0.25 }}
      />

      <div className="relative flex items-center justify-between mb-5">
        <div>
          <div className="fm-eyebrow">Pack opening</div>
          <h2
            className="fm-display fm-gold-metal-text"
            style={{ fontSize: 28, marginTop: 4 }}
          >
            {step < reveal.length ? "Sorteando…" : "Draw completo"}
          </h2>
        </div>
        <span className="chip mono">
          {Math.min(step, reveal.length)} / {reveal.length}
        </span>
      </div>

      {/* progress */}
      <div
        className="relative mb-5"
        style={{
          height: 3,
          borderRadius: 2,
          background: "rgba(240,196,96,0.12)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "var(--fm-gold-metal)",
            transition: "width 0.5s var(--fm-ease-out)",
          }}
        />
      </div>

      <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3">
        {bombos.map((b) => {
          const isActive = b.numero === currentBombo;
          const isDone = b.numero < currentBombo;
          return (
            <div
              key={b.numero}
              className={`bombo-card-${b.numero} relative rounded-lg p-3 transition-all`}
              style={{
                border: isActive
                  ? "1px solid var(--fm-gold)"
                  : "1px solid rgba(240,196,96,0.18)",
                boxShadow: isActive
                  ? "0 0 0 1px var(--fm-gold-glow), 0 0 32px rgba(240,196,96,0.3)"
                  : "none",
                opacity: isDone ? 0.6 : 1,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className="fm-eyebrow"
                  style={{ color: "var(--fm-gold)" }}
                >
                  Bombo {b.numero}
                </div>
                <span style={{ fontSize: 18 }}>🥁</span>
              </div>
              <ul className="space-y-1">
                {b.equipos.map((e) => {
                  const out = caidos.has(e.name);
                  return (
                    <li
                      key={e.name}
                      className={`flex justify-between text-xs transition-all duration-300
                        ${
                          out
                            ? "line-through opacity-25"
                            : isActive
                              ? "text-ink"
                              : "text-ink-muted"
                        }`}
                    >
                      <span className="truncate font-sans uppercase tracking-wider">
                        {e.type === "club" ? "🏆" : "🏳️"} {e.name}
                      </span>
                      <span className="mono" style={{ fontSize: 10 }}>
                        {e.ovr}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
