import type { SorteoResponse } from "../api/client";

export function toCsv(s: SorteoResponse): string {
  const rows: string[][] = [];
  rows.push(["# Sorteo FC 26"]);
  rows.push(["sorteo_id", s.sorteo_id]);
  rows.push(["timestamp", s.timestamp]);
  rows.push(["mode", s.mode]);
  rows.push(["seed", s.seed === null ? "" : String(s.seed)]);
  rows.push(["hash", s.hash]);
  rows.push([]);
  rows.push(["participant", "team", "ovr", "bombo", "pick_order"]);
  for (const a of s.assignments) {
    rows.push([a.participant, a.team, String(a.ovr), String(a.bombo), String(a.pick_order)]);
  }
  if (s.groups) {
    rows.push([]);
    rows.push(["# Grupos"]);
    rows.push(["grupo", "participant", "team", "ovr", "bombo"]);
    for (const g of s.groups) {
      for (const i of g.integrantes) {
        rows.push([g.nombre, i.participant, i.team, String(i.ovr), String(i.bombo)]);
      }
    }
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function csvCell(v: string): string {
  if (v === "") return "";
  if (/[",\r\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}

export function toJson(s: SorteoResponse): string {
  return JSON.stringify(s, Object.keys(s).sort(), 2);
}

export function toMarkdown(s: SorteoResponse): string {
  const lines: string[] = [];
  lines.push(`# Sorteo FC 26 — \`${s.sorteo_id}\``);
  lines.push("");
  lines.push(`- **Timestamp (UTC):** ${s.timestamp}`);
  lines.push(`- **Modo:** \`${s.mode}\``);
  lines.push(`- **Semilla:** ${s.seed !== null ? s.seed : "CSPRNG (secrets)"}`);
  lines.push(`- **Hash SHA-256:** \`${s.hash}\``);
  lines.push("");
  lines.push("## Bombos");
  for (const b of s.bombos) {
    const equipos = b.equipos.map((e) => e.name).join(", ");
    lines.push(`- **Bombo ${b.numero}** (OVR ${b.ovr_range}): ${equipos}`);
  }
  lines.push("");
  lines.push("## Asignaciones");
  lines.push("");
  lines.push("| Pick | Participante | Equipo | OVR | Bombo |");
  lines.push("|------|--------------|--------|-----|-------|");
  [...s.assignments]
    .sort((a, b) => a.pick_order - b.pick_order)
    .forEach((a) => {
      lines.push(`| ${a.pick_order} | ${a.participant} | ${a.team} | ${a.ovr} | ${a.bombo} |`);
    });
  if (s.groups) {
    lines.push("");
    lines.push("## Grupos");
    for (const g of s.groups) {
      lines.push("");
      lines.push(`### ${g.nombre}`);
      lines.push("");
      lines.push("| Participante | Equipo | OVR | Bombo |");
      lines.push("|--------------|--------|-----|-------|");
      for (const i of g.integrantes) {
        lines.push(`| ${i.participant} | ${i.team} | ${i.ovr} | ${i.bombo} |`);
      }
    }
  }
  return lines.join("\n") + "\n";
}

export function exportSorteo(s: SorteoResponse, format: "csv" | "json" | "md"):
  { content: string; mime: string; filename: string } {
  if (format === "csv") return { content: toCsv(s), mime: "text/csv;charset=utf-8", filename: `sorteo_${s.sorteo_id}.csv` };
  if (format === "json") return { content: toJson(s), mime: "application/json;charset=utf-8", filename: `sorteo_${s.sorteo_id}.json` };
  if (format === "md") return { content: toMarkdown(s), mime: "text/markdown;charset=utf-8", filename: `sorteo_${s.sorteo_id}.md` };
  throw new Error(`Formato no soportado: ${format}`);
}
