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
    title: "Champions",
    description:
      "Divide a los participantes en grupos. Cada grupo recibe exactamente un equipo de cada bombo. Requiere N múltiplo del número de bombos.",
  },
  {
    id: "draft_bombos",
    title: "Draft",
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
    <div className="fm-surface">
      <div className="mb-4">
        <div className="fm-eyebrow">Draw mode</div>
        <h2 className="fm-h2" style={{ marginTop: 2 }}>
          Modo de sorteo
        </h2>
      </div>
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
              style={{
                textAlign: "left",
                border: selected
                  ? "1px solid var(--fm-gold)"
                  : "1px solid rgba(240,196,96,0.18)",
                background: selected
                  ? "rgba(240,196,96,0.1)"
                  : "rgba(5,7,12,0.4)",
                boxShadow: selected
                  ? "0 0 0 1px var(--fm-gold), 0 0 32px rgba(240,196,96,0.25)"
                  : "none",
                borderRadius: 10,
                padding: 16,
                cursor: enabled ? "pointer" : "not-allowed",
                opacity: enabled ? 1 : 0.4,
                transition: "all 0.2s var(--fm-ease-out)",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="fm-display"
                  style={{
                    fontSize: 18,
                    color: selected ? "var(--fm-gold)" : "var(--fm-ink)",
                  }}
                >
                  {m.title}
                </span>
                {selected && (
                  <span style={{ color: "var(--fm-gold)" }}>●</span>
                )}
              </div>
              <p
                style={{
                  fontFamily: "var(--fm-font-body)",
                  fontSize: 12,
                  color: "var(--fm-ink-muted)",
                  lineHeight: 1.5,
                }}
              >
                {m.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
