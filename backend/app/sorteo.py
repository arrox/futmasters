"""
Lógica de sorteo en tres modos: simple, bombo_equilibrado, draft_bombos.

La fuente de aleatoriedad es ``secrets.SystemRandom`` (CSPRNG) salvo que
se provea un ``seed`` explícito (para reproducibilidad / demos públicas).
"""
from __future__ import annotations

import random
import secrets
from typing import List, Optional, Tuple

from .bombos import bombo_of_team, build_bombos


# Modos soportados
MODE_SIMPLE = "simple"
MODE_BOMBO_EQUILIBRADO = "bombo_equilibrado"
MODE_DRAFT = "draft_bombos"
VALID_MODES = {MODE_SIMPLE, MODE_BOMBO_EQUILIBRADO, MODE_DRAFT}


def _rng(seed: Optional[int]) -> random.Random:
    """Devuelve el RNG a usar: semillado determinista o CSPRNG."""
    if seed is None:
        return secrets.SystemRandom()
    return random.Random(seed)


def available_modes(n: int, num_bombos: int) -> List[str]:
    """Modos disponibles dado N participantes y cantidad de bombos."""
    modes = [MODE_SIMPLE, MODE_DRAFT]
    if num_bombos > 0 and n % num_bombos == 0:
        modes.insert(1, MODE_BOMBO_EQUILIBRADO)
    return modes


def sortear_simple(
    participants: List[str],
    pool: List[dict],
    bombos: List[dict],
    seed: Optional[int],
) -> Tuple[List[dict], None]:
    """
    Modo simple: baraja el pool completo y asigna 1:1 a participantes en orden.

    :returns: ``(assignments, None)``.
    """
    rng = _rng(seed)
    shuffled = list(pool)
    rng.shuffle(shuffled)

    assignments: List[dict] = []
    for i, (participant, team) in enumerate(zip(participants, shuffled), start=1):
        assignments.append(
            {
                "participant": participant,
                "team": team["name"],
                "ovr": team["ovr"],
                "bombo": bombo_of_team(bombos, team["name"]),
                "pick_order": i,
            }
        )
    return assignments, None


def sortear_bombo_equilibrado(
    participants: List[str],
    pool: List[dict],
    bombos: List[dict],
    seed: Optional[int],
) -> Tuple[List[dict], List[dict]]:
    """
    Reparte los equipos de modo que cada grupo de participantes reciba
    exactamente un equipo de cada bombo.

    Requiere que ``len(participants) % len(bombos) == 0``.

    :returns: ``(assignments, groups)``.
    """
    n = len(participants)
    b = len(bombos)
    if b == 0 or n % b != 0:
        raise ValueError(
            "Modo bombo_equilibrado requiere N múltiplo del número de bombos"
        )

    rng = _rng(seed)
    num_grupos = n // b

    # 1) Barajar orden de participantes -> definir a qué grupo va cada uno.
    participantes_idx = list(range(n))
    rng.shuffle(participantes_idx)
    # Dividir en ``num_grupos`` grupos de ``b`` participantes.
    grupos_participantes: List[List[int]] = [
        participantes_idx[i * b : (i + 1) * b] for i in range(num_grupos)
    ]

    # 2) Para cada bombo: barajar sus equipos y repartirlos entre los grupos.
    # Cada grupo recibe exactamente un equipo del bombo.
    equipos_por_grupo: List[List[dict]] = [[] for _ in range(num_grupos)]
    for bombo in bombos:
        equipos = list(bombo["equipos"])
        rng.shuffle(equipos)
        # Aseguramos que el bombo tenga al menos ``num_grupos`` equipos.
        # Si los tamaños coinciden (N múltiplo de B) y OVR-ordering es correcto,
        # cada bombo tendrá ``num_grupos`` equipos. Validamos por las dudas.
        if len(equipos) < num_grupos:
            raise ValueError(
                "Bombo con menos equipos que grupos de participantes — inconsistente"
            )
        for g_idx in range(num_grupos):
            equipos_por_grupo[g_idx].append(equipos[g_idx])

    # 3) Dentro de cada grupo asignamos equipos a participantes en orden aleatorio.
    assignments: List[Optional[dict]] = [None] * n
    pick_order = 0
    groups_out: List[dict] = []
    for g_idx, participantes_del_grupo in enumerate(grupos_participantes):
        # Aleatorizamos qué participante del grupo recibe cada bombo.
        idx_participantes = list(participantes_del_grupo)
        rng.shuffle(idx_participantes)
        equipos_del_grupo = equipos_por_grupo[g_idx]
        # equipos_del_grupo ya tiene un equipo por bombo en orden bombo1..bomboB.
        grupo_entries = []
        for team, p_idx in zip(equipos_del_grupo, idx_participantes):
            pick_order += 1
            assignment = {
                "participant": participants[p_idx],
                "team": team["name"],
                "ovr": team["ovr"],
                "bombo": bombo_of_team(bombos, team["name"]),
                "pick_order": pick_order,
            }
            assignments[p_idx] = assignment
            grupo_entries.append(
                {
                    "participant": participants[p_idx],
                    "team": team["name"],
                    "ovr": team["ovr"],
                    "bombo": assignment["bombo"],
                }
            )
        groups_out.append(
            {
                "nombre": _group_label(g_idx),
                "integrantes": grupo_entries,
            }
        )

    # None no debería quedar; lo asertamos.
    result: List[dict] = [a for a in assignments if a is not None]
    if len(result) != n:
        raise RuntimeError("Asignaciones incompletas en bombo_equilibrado")
    return result, groups_out


def sortear_draft_bombos(
    participants: List[str],
    pool: List[dict],
    bombos: List[dict],
    seed: Optional[int],
) -> Tuple[List[dict], None]:
    """
    Draft por bombos: los participantes reciben un orden de pick aleatorio;
    para cada bombo (de 1 a B) se barajan sus equipos y se entregan a los
    siguientes ``len(bombo)`` participantes en el orden de pick.
    """
    n = len(participants)
    total_equipos = sum(len(b["equipos"]) for b in bombos)
    if total_equipos != n:
        raise ValueError(
            "Cantidad de equipos en bombos no coincide con participantes"
        )

    rng = _rng(seed)

    # 1) Orden de pick aleatorio (1..N) para cada participante.
    orden_pick = list(range(n))
    rng.shuffle(orden_pick)
    # orden_pick[k] = índice del participante que tiene el pick nro k+1

    # 2) Recorrer bombos en orden; dentro de cada bombo barajar equipos y
    # asignarlos a los próximos participantes del orden de pick.
    assignments: List[Optional[dict]] = [None] * n
    cursor = 0
    for bombo in bombos:
        equipos = list(bombo["equipos"])
        rng.shuffle(equipos)
        for team in equipos:
            p_idx = orden_pick[cursor]
            assignments[p_idx] = {
                "participant": participants[p_idx],
                "team": team["name"],
                "ovr": team["ovr"],
                "bombo": bombo["numero"],
                "pick_order": cursor + 1,
            }
            cursor += 1

    result: List[dict] = [a for a in assignments if a is not None]
    if len(result) != n:
        raise RuntimeError("Asignaciones incompletas en draft_bombos")
    return result, None


def ejecutar_sorteo(
    participants,
    mode: str,
    seed: Optional[int] = None,
) -> dict:
    """
    Punto de entrada único del sorteo.

    ``participants`` puede ser lista de strings (solo nombres) o lista de
    dicts ``{"name", "email"}``. Devuelve ``pool``, ``bombos``,
    ``assignments`` (con email opcional), ``groups`` y ``participants``
    (lista de dicts normalizada).
    """
    from .pool_selector import select_effective_pool

    if mode not in VALID_MODES:
        raise ValueError(f"Modo inválido: {mode}")
    n = len(participants)
    if n < 2 or n > 20:
        raise ValueError("Cantidad de participantes debe estar entre 2 y 20")

    # Normalizar a dicts y separar nombres del resto.
    norm: List[dict] = []
    for p in participants:
        if isinstance(p, str):
            norm.append({"name": p, "email": None})
        elif isinstance(p, dict):
            norm.append({"name": p["name"], "email": p.get("email")})
        else:
            raise ValueError("Participantes inválidos")
    names = [p["name"] for p in norm]

    pool = select_effective_pool(n)
    bombos = build_bombos(pool)

    if mode == MODE_SIMPLE:
        assignments, groups = sortear_simple(names, pool, bombos, seed)
    elif mode == MODE_BOMBO_EQUILIBRADO:
        assignments, groups = sortear_bombo_equilibrado(names, pool, bombos, seed)
    else:  # MODE_DRAFT
        assignments, groups = sortear_draft_bombos(names, pool, bombos, seed)

    # Inyectar email en cada assignment según el nombre original.
    email_by_name = {p["name"]: p.get("email") for p in norm}
    for a in assignments:
        a["email"] = email_by_name.get(a["participant"])
    if groups:
        for g in groups:
            for i in g["integrantes"]:
                i["email"] = email_by_name.get(i["participant"])

    return {
        "pool": pool,
        "bombos": bombos,
        "assignments": assignments,
        "groups": groups,
        "participants_ext": norm,
    }


def _group_label(idx: int) -> str:
    """Convierte 0,1,2,... en 'Grupo A', 'Grupo B', ..."""
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    if idx < len(letters):
        return f"Grupo {letters[idx]}"
    return f"Grupo {idx + 1}"
