"""
Armado determinista de bombos sobre un pool efectivo.

Reglas:
- Si N < 4: B = N (un bombo por equipo).
- Si N >= 4: B = 4.
- Tamaño base por bombo = N // B; los primeros N % B bombos reciben uno extra.
- Los equipos se ordenan por OVR DESC, desempate por priority ASC, y se
  distribuyen en ese orden entre los bombos (mayor OVR en bombo 1).
"""
from __future__ import annotations

from typing import List


NUM_BOMBOS_DEFAULT = 4


def compute_num_bombos(n: int) -> int:
    """Devuelve el número de bombos efectivo según N equipos."""
    if n < 1:
        raise ValueError("n debe ser >= 1")
    if n < NUM_BOMBOS_DEFAULT:
        return n
    return NUM_BOMBOS_DEFAULT


def compute_bombo_sizes(n: int) -> List[int]:
    """Devuelve los tamaños de cada bombo (lista de longitud B)."""
    b = compute_num_bombos(n)
    base = n // b
    extra = n % b
    return [base + (1 if i < extra else 0) for i in range(b)]


def build_bombos(pool: List[dict]) -> List[dict]:
    """
    Construye la lista de bombos dado un pool efectivo.

    :returns: lista de dicts con claves ``numero``, ``equipos`` y ``ovr_range``.
    """
    n = len(pool)
    if n == 0:
        return []

    # Orden determinista: OVR DESC, desempate priority ASC.
    ordered = sorted(pool, key=lambda t: (-t["ovr"], t["priority"]))
    sizes = compute_bombo_sizes(n)

    bombos: List[dict] = []
    cursor = 0
    for idx, size in enumerate(sizes, start=1):
        equipos = [dict(t) for t in ordered[cursor : cursor + size]]
        cursor += size
        ovrs = [e["ovr"] for e in equipos]
        ovr_range = (
            f"{min(ovrs)}-{max(ovrs)}" if ovrs else ""
        )
        bombos.append(
            {
                "numero": idx,
                "equipos": equipos,
                "ovr_range": ovr_range,
            }
        )
    return bombos


def bombo_of_team(bombos: List[dict], team_name: str) -> int:
    """Devuelve el número de bombo al que pertenece un equipo."""
    for b in bombos:
        if any(e["name"] == team_name for e in b["equipos"]):
            return b["numero"]
    raise KeyError(f"Equipo no encontrado en bombos: {team_name}")
