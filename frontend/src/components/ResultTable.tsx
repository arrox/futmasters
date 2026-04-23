import type { Assignment } from "../api/client";

interface Props {
  assignments: Assignment[];
  pool: { name: string; type: "club" | "nation" }[];
  revealedUpTo: number;
}

export default function ResultTable({
  assignments,
  pool,
  revealedUpTo,
}: Props) {
  const typeMap = new Map(pool.map((t) => [t.name, t.type]));
  const sorted = [...assignments].sort(
    (a, b) => a.pick_order - b.pick_order,
  );
  return (
    <div className="fm-surface overflow-x-auto">
      <div className="mb-3">
        <div className="fm-eyebrow">Draw result</div>
        <h2 className="fm-h2" style={{ marginTop: 2 }}>
          Asignaciones
        </h2>
        <div className="fm-bar-gold" style={{ marginTop: 8, width: 60 }} />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400 border-b border-soft/60">
            <th className="py-2 pr-3">#</th>
            <th className="py-2 pr-3">Participante</th>
            <th className="py-2 pr-3">Equipo</th>
            <th className="py-2 pr-3">Tipo</th>
            <th className="py-2 pr-3">OVR</th>
            <th className="py-2">Bombo</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => {
            const isRevealed = a.pick_order <= revealedUpTo;
            const type = typeMap.get(a.team) ?? "club";
            return (
              <tr
                key={a.pick_order}
                className={`border-b border-soft/20 transition-colors bombo-row-${a.bombo}
                  ${isRevealed ? "animate-fadeUp" : "opacity-0"}`}
              >
                <td className="py-2 pr-3 mono text-slate-400">
                  {a.pick_order}
                </td>
                <td className="py-2 pr-3 font-medium">{a.participant}</td>
                <td className="py-2 pr-3">
                  {isRevealed ? a.team : "—"}
                </td>
                <td className="py-2 pr-3">
                  {isRevealed ? (type === "club" ? "🏆 Club" : "🏳️ Selección") : ""}
                </td>
                <td className="py-2 pr-3 mono">
                  {isRevealed ? a.ovr : ""}
                </td>
                <td className="py-2 mono">
                  {isRevealed ? a.bombo : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
