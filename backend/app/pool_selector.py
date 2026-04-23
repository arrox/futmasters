"""
Selección del pool efectivo de equipos según número de participantes.

Reglas:
1. Ordenar ``TEAMS`` por ``priority`` ASC.
2. Separar en clubes (``type == 'club'``) y selecciones (``type == 'nation'``).
3. Construir pool de tamaño ``N``:
   - Si ``N <= len(CLUBS)``: pool = primeros N clubes por priority.
   - Si ``N > len(CLUBS)``: pool = todos los clubes + selecciones por priority ASC.
"""
from __future__ import annotations

from typing import List, Tuple

from .teams import TEAMS


def split_pool() -> Tuple[List[dict], List[dict]]:
    """Devuelve ``(clubes, selecciones)`` ordenados por priority ASC."""
    sorted_teams = sorted((dict(t) for t in TEAMS), key=lambda t: t["priority"])
    clubs = [t for t in sorted_teams if t["type"] == "club"]
    nations = [t for t in sorted_teams if t["type"] == "nation"]
    return clubs, nations


def select_effective_pool(n: int) -> List[dict]:
    """
    Devuelve la lista de ``n`` equipos priorizando clubes sobre selecciones.

    :param n: cantidad de participantes (equipos a devolver).
    :raises ValueError: si ``n`` es inválido.
    """
    if n < 1:
        raise ValueError("n debe ser >= 1")
    if n > len(TEAMS):
        raise ValueError(f"n no puede exceder {len(TEAMS)} (pool total)")

    clubs, nations = split_pool()

    if n <= len(clubs):
        return [dict(t) for t in clubs[:n]]

    faltan = n - len(clubs)
    pool = [dict(t) for t in clubs] + [dict(t) for t in nations[:faltan]]
    return pool


def describe_pool(pool: List[dict]) -> dict:
    """Devuelve contadores de clubes y selecciones del pool dado."""
    clubs = sum(1 for t in pool if t["type"] == "club")
    nations = sum(1 for t in pool if t["type"] == "nation")
    return {"clubs_count": clubs, "nations_count": nations}
