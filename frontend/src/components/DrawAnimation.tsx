import { useEffect, useMemo, useState } from "react";
import type { Assignment, BombosPreview } from "../api/client";

interface Props {
  bombos: BombosPreview[];
  assignments: Assignment[];
  onRevealUpdate: (upTo: number) => void;
  onDone: () => void;
}

const STEP_MS = 450;

export default function DrawAnimation({
  bombos,
  assignments,
  onRevealUpdate,
  onDone,
}: Props) {
  // Asignaciones en el orden en que se revelan: primero por bombo (1..B),
  // luego por pick_order dentro del bombo.
  const reveal = useMemo(() => {
    return [...assignments].sort(
      (a, b) => a.bombo - b.bombo || a.pick_order - b.pick_order,
    );
  }, [assignments]);

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

  // Revelamos los equipos "caidos" del bombo actual hasta step-1.
  const caidos = new Set(reveal.slice(0, step).map((a) => a.team));
  const currentBombo =
    step < reveal.length ? reveal[step].bombo : bombos.length;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Sorteando…</h2>
        <span className="mono text-xs text-slate-400">
          {Math.min(step, reveal.length)} / {reveal.length}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {bombos.map((b) => {
          const isActive = b.numero === currentBombo;
          return (
            <div
              key={b.numero}
              className={`bombo-card-${b.numero} border rounded-lg p-3 transition-all
                ${
                  isActive
                    ? "border-accent shadow-glow-strong"
                    : "border-soft"
                }`}
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold">Bombo {b.numero}</span>
                <span>🥁</span>
              </div>
              <ul className="space-y-1">
                {b.equipos.map((e) => {
                  const isOut = caidos.has(e.name);
                  return (
                    <li
                      key={e.name}
                      className={`text-xs flex justify-between transition-all duration-300
                        ${isOut ? "line-through opacity-30" : ""}
                      `}
                    >
                      <span>
                        {e.type === "club" ? "🏆" : "🏳️"} {e.name}
                      </span>
                      <span className="mono text-slate-400">{e.ovr}</span>
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
