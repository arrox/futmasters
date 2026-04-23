"""Exportadores CSV / JSON / Markdown para resultados de sorteo."""
from __future__ import annotations

import csv
import io
import json
from typing import Tuple


def to_csv(sorteo: dict) -> str:
    """Exporta las asignaciones en CSV (incluye encabezado de metadatos)."""
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["# Sorteo FC 26"])
    w.writerow(["sorteo_id", sorteo["sorteo_id"]])
    w.writerow(["timestamp", sorteo["timestamp"]])
    w.writerow(["mode", sorteo["mode"]])
    w.writerow(["seed", sorteo.get("seed")])
    w.writerow(["hash", sorteo["hash"]])
    w.writerow([])
    w.writerow(["participant", "team", "ovr", "bombo", "pick_order"])
    for a in sorteo["assignments"]:
        w.writerow([a["participant"], a["team"], a["ovr"], a["bombo"], a["pick_order"]])
    if sorteo.get("groups"):
        w.writerow([])
        w.writerow(["# Grupos"])
        w.writerow(["grupo", "participant", "team", "ovr", "bombo"])
        for g in sorteo["groups"]:
            for i in g["integrantes"]:
                w.writerow([g["nombre"], i["participant"], i["team"], i["ovr"], i["bombo"]])
    return buf.getvalue()


def to_json(sorteo: dict) -> str:
    """Exporta el sorteo completo en JSON indentado."""
    return json.dumps(sorteo, indent=2, ensure_ascii=False, sort_keys=True)


def to_markdown(sorteo: dict) -> str:
    """Exporta el sorteo como Markdown legible."""
    lines = []
    lines.append(f"# Sorteo FC 26 — `{sorteo['sorteo_id']}`")
    lines.append("")
    lines.append(f"- **Timestamp (UTC):** {sorteo['timestamp']}")
    lines.append(f"- **Modo:** `{sorteo['mode']}`")
    seed = sorteo.get("seed")
    lines.append(f"- **Semilla:** {seed if seed is not None else 'CSPRNG (secrets)'}")
    lines.append(f"- **Hash SHA-256:** `{sorteo['hash']}`")
    lines.append("")
    lines.append("## Bombos")
    for b in sorteo["bombos"]:
        equipos = ", ".join(e["name"] for e in b["equipos"])
        lines.append(f"- **Bombo {b['numero']}** (OVR {b['ovr_range']}): {equipos}")
    lines.append("")
    lines.append("## Asignaciones")
    lines.append("")
    lines.append("| Pick | Participante | Equipo | OVR | Bombo |")
    lines.append("|------|--------------|--------|-----|-------|")
    for a in sorted(sorteo["assignments"], key=lambda x: x["pick_order"]):
        lines.append(
            f"| {a['pick_order']} | {a['participant']} | {a['team']} | {a['ovr']} | {a['bombo']} |"
        )
    if sorteo.get("groups"):
        lines.append("")
        lines.append("## Grupos")
        for g in sorteo["groups"]:
            lines.append("")
            lines.append(f"### {g['nombre']}")
            lines.append("")
            lines.append("| Participante | Equipo | OVR | Bombo |")
            lines.append("|--------------|--------|-----|-------|")
            for i in g["integrantes"]:
                lines.append(
                    f"| {i['participant']} | {i['team']} | {i['ovr']} | {i['bombo']} |"
                )
    return "\n".join(lines) + "\n"


def export(sorteo: dict, format: str) -> Tuple[str, str, str]:
    """
    Devuelve ``(contenido, content_type, filename)`` para el formato pedido.
    """
    sid = sorteo["sorteo_id"]
    fmt = format.lower()
    if fmt == "csv":
        return to_csv(sorteo), "text/csv; charset=utf-8", f"sorteo_{sid}.csv"
    if fmt == "json":
        return to_json(sorteo), "application/json; charset=utf-8", f"sorteo_{sid}.json"
    if fmt == "md":
        return to_markdown(sorteo), "text/markdown; charset=utf-8", f"sorteo_{sid}.md"
    raise ValueError(f"Formato no soportado: {format}")
