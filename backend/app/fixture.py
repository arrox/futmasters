"""
Generación de fixtures: round-robin por el método del círculo + bracket de KO.
"""
from __future__ import annotations

from typing import List, Tuple


def round_robin_pairs(player_ids: List[int]) -> List[List[Tuple[int, int]]]:
    """
    Devuelve una lista de rondas. Cada ronda es una lista de pares (home, away).

    Algoritmo del círculo: fijamos al primer jugador y rotamos el resto.
    Si el número de jugadores es impar se agrega un BYE (``-1``) que se omite.
    """
    ids = list(player_ids)
    if len(ids) < 2:
        return []
    bye = False
    if len(ids) % 2 == 1:
        ids.append(-1)
        bye = True
    n = len(ids)
    rounds: List[List[Tuple[int, int]]] = []
    fixed = ids[0]
    rotating = ids[1:]

    for r in range(n - 1):
        round_pairs: List[Tuple[int, int]] = []
        # El fijo juega contra el primer rotating
        pair = (fixed, rotating[0])
        if -1 not in pair:
            # alternamos localía para que no siempre sea local el fijo
            if r % 2 == 1:
                pair = (pair[1], pair[0])
            round_pairs.append(pair)

        # Resto se empareja desde los extremos hacia el centro
        left, right = rotating[1:], rotating[::-1][:-1]  # copia
        # Mejor: iterar sobre pares (i, n-2-i) en rotating
        for i in range(1, len(rotating) // 2 + 1):
            h = rotating[i]
            a = rotating[-i]
            if h == a:
                continue
            pair = (h, a)
            if -1 in pair:
                continue
            if r % 2 == 1:
                pair = (pair[1], pair[0])
            round_pairs.append(pair)

        rounds.append(round_pairs)
        # Rotación
        rotating = [rotating[-1]] + rotating[:-1]

    return rounds


def knockout_bracket(
    slots: List[str],
    num_groups: int = 0,
    qualify_per_group: int = 0,
) -> List[List[Tuple[str, str]]]:
    """
    Devuelve el bracket como lista de rondas. Cada ronda es lista de pares
    ``(slot_home, slot_away)``. La primera ronda usa slots tipo ``A1``/``B2``;
    las siguientes usan ``W{match_id}`` que se rellenan al propagar el ganador.

    Para evitar dependencia de IDs de DB acá devolvemos rotulos ``W_{r}_{p}``
    que el caller puede mapear a ``W{match_id}``.

    Patrón estándar: A1-B2, C1-D2, E1-F2, G1-H2 ... y los ganadores se cruzan
    en orden. Acá usamos un patrón genérico: emparejamos (A1 vs último grupo 2º),
    para que un segundo no pueda cruzarse con un primero de su mismo grupo antes
    de la final.
    """
    total = len(slots)
    if total == 0 or total & (total - 1) != 0:
        raise ValueError("Cantidad de slots debe ser potencia de 2")

    # Orden inicial de los slots.
    first_round = _seed_order(slots, num_groups, qualify_per_group)

    rounds: List[List[Tuple[str, str]]] = []
    round0 = [(first_round[i], first_round[i + 1]) for i in range(0, total, 2)]
    rounds.append(round0)

    prev_count = len(round0)
    round_idx = 1
    while prev_count > 1:
        next_round: List[Tuple[str, str]] = []
        for i in range(0, prev_count, 2):
            slot_h = f"W_{round_idx - 1}_{i}"
            slot_a = f"W_{round_idx - 1}_{i + 1}"
            next_round.append((slot_h, slot_a))
        rounds.append(next_round)
        prev_count = len(next_round)
        round_idx += 1

    return rounds


def _seed_order(
    slots: List[str], num_groups: int, qualify_per_group: int
) -> List[str]:
    """
    Arma el orden de siembra del bracket.

    Si los slots vienen como ``A1``, ``A2``, ``B1``, ``B2``, ... los ordenamos
    para que los 1° vayan contra los 2° de otro grupo y que los 1° estén
    distribuidos en mitades distintas del bracket.

    Para casos simples (slots no reconocibles) devolvemos el orden tal cual.
    """
    if not (num_groups and qualify_per_group):
        return list(slots)

    # Agrupar por grupo.
    by_group: dict[str, List[str]] = {}
    for s in slots:
        # Asumimos formato letra + número
        if len(s) >= 2 and s[-1].isdigit():
            label = s[:-1]
            by_group.setdefault(label, []).append(s)

    groups = sorted(by_group.keys())
    if len(groups) != num_groups:
        return list(slots)

    # Emparejamiento A1-B2, B1-A2, C1-D2, D1-C2, ...
    order: List[str] = []
    for i in range(0, num_groups, 2):
        ga = groups[i]
        gb = groups[i + 1] if i + 1 < num_groups else ga
        # 1° del grupo A vs 2° del grupo B
        pair_list_a = sorted(by_group[ga], key=lambda s: int(s[-1]))
        pair_list_b = sorted(by_group[gb], key=lambda s: int(s[-1]))
        for k in range(qualify_per_group):
            if k == 0:
                order.append(pair_list_a[0])  # A1
                order.append(pair_list_b[1] if len(pair_list_b) > 1 else pair_list_b[0])  # B2
            elif k == 1:
                order.append(pair_list_b[0])  # B1
                order.append(pair_list_a[1] if len(pair_list_a) > 1 else pair_list_a[0])  # A2
            else:
                # Casos con más de 2 clasificados por grupo — alternamos.
                order.append(pair_list_a[k])
                order.append(pair_list_b[k])
    return order
