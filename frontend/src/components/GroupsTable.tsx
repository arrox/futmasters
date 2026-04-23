import type { Group } from "../api/client";

interface Props {
  groups: Group[];
}

export default function GroupsTable({ groups }: Props) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-3">Grupos balanceados</h2>
      <p className="text-sm text-slate-400 mb-4">
        Cada grupo contiene exactamente un equipo de cada bombo.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {groups.map((g) => (
          <div
            key={g.nombre}
            className="border border-soft rounded-lg p-4 bg-bg/40"
          >
            <div className="font-semibold mb-2 text-accent">{g.nombre}</div>
            <table className="w-full text-sm">
              <tbody>
                {g.integrantes.map((i) => (
                  <tr
                    key={i.participant}
                    className={`border-b border-soft/20 bombo-row-${i.bombo}`}
                  >
                    <td className="py-1.5 pr-2 font-medium">
                      {i.participant}
                    </td>
                    <td className="py-1.5 pr-2">{i.team}</td>
                    <td className="py-1.5 pr-2 mono text-xs text-slate-400">
                      OVR {i.ovr}
                    </td>
                    <td className="py-1.5 mono text-xs text-slate-400">
                      B{i.bombo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
