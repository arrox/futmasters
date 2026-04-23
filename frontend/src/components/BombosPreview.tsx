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
    <div className="card">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="text-lg font-semibold">Pool y bombos</h2>
        <div className="flex gap-2">
          <span className="chip">🏆 {clubsCount} clubes</span>
          <span className="chip">🏳️ {nationsCount} selecciones</span>
        </div>
      </div>
      <p className="text-sm text-slate-400 mb-4">
        {participants < 12
          ? `Con ${participants} participantes usamos solo los ${participants} primeros clubes por prioridad.`
          : `Con ${participants} participantes usamos todos los clubes y completamos con ${nationsCount} selecciones top.`}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {bombos.map((b) => (
          <div
            key={b.numero}
            className={`bombo-card-${b.numero} border border-soft rounded-lg p-4`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🥁</span>
                <span className="font-semibold">Bombo {b.numero}</span>
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
                    <span>{e.name}</span>
                  </span>
                  <span className="mono text-xs text-slate-400">
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
