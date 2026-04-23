import type { BombosPreview as BombosPreviewType } from "../api/client";

interface Props {
  bombos: BombosPreviewType[];
  clubsCount: number;
  nationsCount: number;
  participants: number;
}

export default function BombosPreview({
  bombos,
  clubsCount,
  nationsCount,
  participants,
}: Props) {
  return (
    <div className="fm-surface">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <div className="fm-eyebrow">Pool seeding</div>
          <h2 className="fm-h2" style={{ marginTop: 2 }}>
            Pool y bombos
          </h2>
        </div>
        <div className="flex gap-2">
          <span className="chip">🏆 {clubsCount} clubes</span>
          <span className="chip chip--totw">🏳️ {nationsCount} selecciones</span>
        </div>
      </div>
      <p
        className="mb-5"
        style={{
          fontFamily: "var(--fm-font-body)",
          fontSize: 13,
          color: "var(--fm-ink-muted)",
          lineHeight: 1.5,
        }}
      >
        {participants < 12
          ? `Con ${participants} participantes se usan solo los ${participants} primeros clubes por prioridad.`
          : `Con ${participants} participantes se usan todos los clubes y se completan con ${nationsCount} selecciones top.`}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {bombos.map((b) => (
          <div
            key={b.numero}
            className={`bombo-card-${b.numero} rounded-lg p-4`}
            style={{
              border: "1px solid rgba(240,196,96,0.2)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 20 }}>🥁</span>
                <div>
                  <div className="fm-eyebrow" style={{ fontSize: 10 }}>
                    Pot
                  </div>
                  <div
                    className="fm-display"
                    style={{ fontSize: 16, color: "var(--fm-gold)" }}
                  >
                    Bombo {b.numero}
                  </div>
                </div>
              </div>
              <span className="chip mono">OVR {b.ovr_range}</span>
            </div>
            <ul className="space-y-1.5">
              {b.equipos.map((e) => (
                <li
                  key={e.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span>{e.type === "club" ? "🏆" : "🏳️"}</span>
                    <span
                      style={{
                        fontFamily: "var(--fm-font-sans)",
                        fontWeight: 500,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {e.name}
                    </span>
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 11, color: "var(--fm-ink-muted)" }}
                  >
                    OVR {e.ovr}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
