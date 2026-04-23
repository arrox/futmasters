"""
Pool estático de equipos EA FC 26 (ratings abril 2026).

El campo ``priority`` indica el orden de selección cuando hay menos
participantes que equipos (menor = mayor prioridad). El campo ``bombo``
es solo referencia histórica; los bombos efectivos se calculan dinámicamente
según el pool resultante.
"""
from __future__ import annotations

from typing import List, TypedDict


class Team(TypedDict):
    """Estructura de un equipo del pool."""

    name: str
    type: str  # "club" | "nation"
    ovr: int
    att: int
    mid: int
    def_: int  # renombrado para evitar colisión con keyword
    bombo: int
    priority: int


# Nota: usamos la clave "def" en el dict público para preservar el contrato
# solicitado por la spec. La clase TypedDict es referencial.
TEAMS: List[dict] = [
    # Elite (OVR 85-88) — priority 1-5
    {"name": "Real Madrid",         "type": "club",   "ovr": 88, "att": 86, "mid": 83, "def": 86, "bombo": 1, "priority": 1},
    {"name": "Manchester City",     "type": "club",   "ovr": 85, "att": 85, "mid": 82, "def": 84, "bombo": 1, "priority": 2},
    {"name": "Paris Saint-Germain", "type": "club",   "ovr": 85, "att": 85, "mid": 86, "def": 85, "bombo": 1, "priority": 3},
    {"name": "FC Barcelona",        "type": "club",   "ovr": 85, "att": 86, "mid": 84, "def": 81, "bombo": 1, "priority": 4},
    {"name": "Francia",             "type": "nation", "ovr": 85, "att": 87, "mid": 83, "def": 85, "bombo": 1, "priority": 5},
    # Top (OVR 84-85) — priority 6-10
    {"name": "España",              "type": "nation", "ovr": 85, "att": 82, "mid": 86, "def": 83, "bombo": 2, "priority": 6},
    {"name": "Bayern Munich",       "type": "club",   "ovr": 84, "att": 85, "mid": 83, "def": 84, "bombo": 2, "priority": 7},
    {"name": "Arsenal",             "type": "club",   "ovr": 84, "att": 84, "mid": 83, "def": 84, "bombo": 2, "priority": 8},
    {"name": "Liverpool",           "type": "club",   "ovr": 84, "att": 84, "mid": 83, "def": 85, "bombo": 2, "priority": 9},
    {"name": "Argentina",           "type": "nation", "ovr": 84, "att": 85, "mid": 82, "def": 83, "bombo": 2, "priority": 10},
    # High (OVR 83-84) — priority 11-15
    {"name": "Inglaterra",          "type": "nation", "ovr": 84, "att": 85, "mid": 84, "def": 81, "bombo": 3, "priority": 11},
    {"name": "Portugal",            "type": "nation", "ovr": 84, "att": 85, "mid": 84, "def": 83, "bombo": 3, "priority": 12},
    {"name": "Inter de Milán",      "type": "club",   "ovr": 83, "att": 83, "mid": 82, "def": 83, "bombo": 3, "priority": 13},
    {"name": "Países Bajos",        "type": "nation", "ovr": 83, "att": 83, "mid": 82, "def": 83, "bombo": 3, "priority": 14},
    {"name": "Alemania",            "type": "nation", "ovr": 83, "att": 82, "mid": 82, "def": 84, "bombo": 3, "priority": 15},
    # Mid-high (OVR 82-83) — priority 16-20
    {"name": "Chelsea",             "type": "club",   "ovr": 83, "att": 83, "mid": 82, "def": 82, "bombo": 4, "priority": 16},
    {"name": "Atlético Madrid",     "type": "club",   "ovr": 83, "att": 82, "mid": 82, "def": 84, "bombo": 4, "priority": 17},
    {"name": "Napoli",              "type": "club",   "ovr": 83, "att": 82, "mid": 82, "def": 83, "bombo": 4, "priority": 18},
    {"name": "Italia",              "type": "nation", "ovr": 83, "att": 82, "mid": 83, "def": 84, "bombo": 4, "priority": 19},
    {"name": "Manchester United",   "type": "club",   "ovr": 82, "att": 82, "mid": 81, "def": 82, "bombo": 4, "priority": 20},
]


def get_teams_sorted() -> List[dict]:
    """Devuelve una copia de ``TEAMS`` ordenada por ``priority`` ASC."""
    return sorted((dict(t) for t in TEAMS), key=lambda t: t["priority"])
