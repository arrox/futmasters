import type { Mode } from "../api/client";

interface Props {
  value: Mode;
  onChange: (m: Mode) => void;
  available: Mode[];
  numBombos: number;
  numParticipants: number;
}

const MODES: { id: Mode; title: string; description: string }[] = [
  {
    id: "simple",
    title: "Simple",
    description:
      "Se barajan todos los equipos del pool y se asignan 1:1 a los participantes. Los bombos se muestran con fines informativos.",
  },
  {
    id: "bombo_equilibrado",
    title: "Bombo equilibrado",
    description:
      "Divide a los participantes en grupos. Cada grupo recibe exactamente un equipo de cada bombo. Requiere N múltiplo del número de bombos.",
  },
  {
    id: "draft_bombos",
    title: "Draft por bombos",
    description:
      "Los participantes reciben un orden de pick aleatorio y se recorren los bombos del 1 al B repartiendo sus equipos en ese orden.",
  },
];

export default function ModeSelector({
  value,
  onChange,
  available,
  numBombos,
  numParticipants,
}: Props) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-3">Modo de sorteo</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {MODES.map((m) => {
          const enabled = available.includes(m.id);
          const selected = value === m.id && enabled;
          const disabledTitle =
            m.id === "bombo_equilibrado" && !enabled
              ? `Requiere que ${numParticipants} sea múltiplo de ${numBombos}`
              : !enabled
                ? "No disponible para esta cantidad de participantes"
                : undefined;
          return (
            <button
              key={m.id}
              disabled={!enabled}
              title={disabledTitle}
              onClick={() => enabled && onChange(m.id)}
              className={`text-left border rounded-lg p-4 transition-all
                ${
                  selected
                    ? "border-accent bg-accent/10 shadow-glow-strong"
                    : "border-soft bg-bg/40 hover:border-accent/70"
                }
                ${!enabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold">{m.title}</span>
                {selected && <span className="text-accent">●</span>}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {m.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
