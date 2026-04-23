"""
Lógica de torneo: creación, asignación de grupos, armado de fixture, standings.

Flujo típico:
1. ``create_from_sorteo(sorteo_id, name, format, num_groups, qualify_per_group)``
   crea un torneo con sus ``players`` copiando las asignaciones del sorteo.
2. ``assign_groups(t_id)`` reparte jugadores en grupos balanceados por bombo.
3. ``generate_group_fixture(t_id)`` arma los partidos de grupo (round robin).
4. Admin carga resultados uno por uno (``set_match_result``).
5. ``compute_standings(t_id)`` devuelve la tabla.
6. Cuando todos los partidos de grupo están jugados, ``advance_to_knockout``
   genera los cruces de eliminatoria sorteando los bombos por posición.
"""
from __future__ import annotations

import json
import secrets
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from . import db
from .fixture import round_robin_pairs, knockout_bracket


FORMAT_GROUPS_KO = "groups_knockout"
FORMAT_LEAGUE = "league"

STATUS_DRAFT = "draft"
STATUS_GROUPS = "groups"
STATUS_KNOCKOUT = "knockout"
STATUS_FINISHED = "finished"

STAGE_GROUP = "group"
STAGE_R16 = "round_of_16"
STAGE_QUARTER = "quarter"
STAGE_SEMI = "semi"
STAGE_FINAL = "final"
STAGE_THIRD = "third_place"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _rand() -> secrets.SystemRandom:
    return secrets.SystemRandom()


# ──────────────────────────────────────────────────────────────
# Creación y setup
# ──────────────────────────────────────────────────────────────
def create_tournament(
    name: str,
    sorteo_id: Optional[str],
    fmt: str,
    num_groups: int,
    qualify_per_group: int,
    points_win: int = 3,
    points_draw: int = 1,
    points_loss: int = 0,
    double_round: bool = False,
) -> dict:
    """Crea el registro del torneo vacío."""
    if fmt not in (FORMAT_GROUPS_KO, FORMAT_LEAGUE):
        raise ValueError("Formato inválido")
    t_id = str(uuid.uuid4())
    now = _now()
    with db.get_conn() as conn:
        conn.execute(
            """
            INSERT INTO tournaments (
                id, name, sorteo_id, format, status, num_groups,
                qualify_per_group, points_win, points_draw, points_loss,
                double_round, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                t_id, name, sorteo_id, fmt, STATUS_DRAFT,
                num_groups, qualify_per_group,
                points_win, points_draw, points_loss,
                1 if double_round else 0, now,
            ),
        )
    return get_tournament(t_id)


def create_from_sorteo(
    sorteo_id: str,
    name: str,
    fmt: str = FORMAT_GROUPS_KO,
    num_groups: int = 4,
    qualify_per_group: int = 2,
    double_round: bool = False,
) -> dict:
    """
    Toma un sorteo existente y crea un torneo con sus jugadores.
    Los jugadores heredan equipo, OVR, bombo y pick_order del sorteo.
    """
    sorteo = db.get_sorteo(sorteo_id)
    if not sorteo:
        raise ValueError("Sorteo no encontrado")

    result = sorteo["full_result"]
    n = len(result["assignments"])
    if fmt == FORMAT_GROUPS_KO:
        if num_groups < 1 or n % num_groups != 0:
            raise ValueError(
                f"Cantidad de participantes ({n}) debe ser múltiplo del número de grupos ({num_groups})"
            )
        if qualify_per_group < 1 or qualify_per_group > (n // num_groups):
            raise ValueError("qualify_per_group inválido")

    t = create_tournament(
        name=name,
        sorteo_id=sorteo_id,
        fmt=fmt,
        num_groups=num_groups if fmt == FORMAT_GROUPS_KO else 0,
        qualify_per_group=qualify_per_group if fmt == FORMAT_GROUPS_KO else 0,
        double_round=double_round,
    )

    # Mapa equipo -> (type, att, mid, def) para persistir stats.
    pool_by_name = {t["name"]: t for t in result["pool"]}

    with db.get_conn() as conn:
        for a in result["assignments"]:
            team = pool_by_name[a["team"]]
            conn.execute(
                """
                INSERT INTO players (
                    tournament_id, display_name, team_name, team_type,
                    team_ovr, team_att, team_mid, team_def,
                    bombo, pick_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    t["id"], a["participant"], team["name"], team["type"],
                    team["ovr"], team["att"], team["mid"], team["def"],
                    a["bombo"], a["pick_order"],
                ),
            )
    return get_tournament(t["id"])


def get_tournament(t_id: str) -> Optional[dict]:
    with db.get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM tournaments WHERE id = ?", (t_id,)
        ).fetchone()
        return dict(row) if row else None


def list_tournaments() -> List[dict]:
    with db.get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM tournaments ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def delete_tournament(t_id: str) -> None:
    with db.get_conn() as conn:
        # Borrado cascada via triggers FK (PRAGMA foreign_keys = ON en get_conn).
        conn.execute("DELETE FROM matches WHERE tournament_id = ?", (t_id,))
        conn.execute("DELETE FROM players WHERE tournament_id = ?", (t_id,))
        conn.execute("DELETE FROM tournaments WHERE id = ?", (t_id,))


def update_tournament(t_id: str, **fields) -> dict:
    allowed = {
        "name", "num_groups", "qualify_per_group",
        "points_win", "points_draw", "points_loss", "double_round",
    }
    updates = {k: v for k, v in fields.items() if k in allowed and v is not None}
    if updates:
        cols = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [t_id]
        with db.get_conn() as conn:
            conn.execute(
                f"UPDATE tournaments SET {cols} WHERE id = ?",
                values,
            )
    return get_tournament(t_id)


# ──────────────────────────────────────────────────────────────
# Jugadores
# ──────────────────────────────────────────────────────────────
def list_players(t_id: str) -> List[dict]:
    with db.get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM players WHERE tournament_id = ? ORDER BY pick_order ASC",
            (t_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_player(player_id: int) -> Optional[dict]:
    with db.get_conn() as conn:
        row = conn.execute("SELECT * FROM players WHERE id = ?", (player_id,)).fetchone()
        return dict(row) if row else None


def update_player(player_id: int, **fields) -> Optional[dict]:
    allowed = {"display_name", "photo_filename", "group_label"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return get_player(player_id)
    cols = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [player_id]
    with db.get_conn() as conn:
        conn.execute(f"UPDATE players SET {cols} WHERE id = ?", values)
    return get_player(player_id)


# ──────────────────────────────────────────────────────────────
# Grupos y fixture
# ──────────────────────────────────────────────────────────────
def _group_label(idx: int) -> str:
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    return letters[idx] if idx < len(letters) else str(idx + 1)


def assign_groups(t_id: str, regenerate: bool = False) -> List[dict]:
    """
    Asigna cada jugador a un grupo balanceado por bombo.

    Usa serpentina: bombo 1 se reparte secuencialmente A,B,C,D; bombo 2 en orden
    inverso D,C,B,A; bombo 3 A,B,C,D; etc. Así cada grupo queda con un
    representante de cada bombo y la distribución es equilibrada.

    Dentro de cada bombo, el orden es aleatorio (CSPRNG).
    """
    t = get_tournament(t_id)
    if not t:
        raise ValueError("Torneo no encontrado")
    if t["format"] != FORMAT_GROUPS_KO:
        raise ValueError("Solo aplica a formato 'groups_knockout'")
    g = t["num_groups"]
    players = list_players(t_id)
    n = len(players)
    if n == 0 or n % g != 0:
        raise ValueError(f"N ({n}) debe ser múltiplo de num_groups ({g})")
    if not regenerate and any(p["group_label"] for p in players):
        raise ValueError("Los grupos ya están asignados. Pasá regenerate=True para re-sortear.")

    rng = _rand()
    by_bombo: dict[int, List[dict]] = {}
    for p in players:
        by_bombo.setdefault(p["bombo"], []).append(p)
    for lst in by_bombo.values():
        rng.shuffle(lst)

    # Si el torneo se creó a partir de un sorteo, los bombos van 1..B donde B == g
    # (porque build_bombos usa N<4→N o 4→4). Pero pueden diferir — serpentina
    # genérica sobre los bombos ordenados por número.
    assignments: dict[int, str] = {}  # player_id -> group label
    for i, bombo_num in enumerate(sorted(by_bombo.keys())):
        lst = by_bombo[bombo_num]
        order = range(g) if i % 2 == 0 else range(g - 1, -1, -1)
        order = list(order)
        # Completamos/recortamos si el bombo tiene distinto tamaño que g
        for idx, player in enumerate(lst):
            group_idx = order[idx % g]
            assignments[player["id"]] = _group_label(group_idx)

    with db.get_conn() as conn:
        # Re-asignación: limpiamos matches previos de grupo al re-sortear.
        if regenerate:
            conn.execute(
                "DELETE FROM matches WHERE tournament_id = ? AND stage = ?",
                (t_id, STAGE_GROUP),
            )
        for pid, label in assignments.items():
            conn.execute(
                "UPDATE players SET group_label = ? WHERE id = ?",
                (label, pid),
            )
        conn.execute(
            "UPDATE tournaments SET status = ? WHERE id = ?",
            (STATUS_GROUPS, t_id),
        )
    return list_players(t_id)


def generate_group_fixture(t_id: str, regenerate: bool = False) -> List[dict]:
    """Genera el fixture round-robin dentro de cada grupo."""
    t = get_tournament(t_id)
    if not t:
        raise ValueError("Torneo no encontrado")
    if t["format"] != FORMAT_GROUPS_KO:
        raise ValueError("Solo aplica a formato 'groups_knockout'")
    players = list_players(t_id)
    if any(p["group_label"] is None for p in players):
        raise ValueError("Faltan asignar grupos (POST /assign-groups)")

    # Si hay partidos jugados, no regenerar sin confirmación.
    with db.get_conn() as conn:
        existing = conn.execute(
            "SELECT COUNT(*) AS c FROM matches WHERE tournament_id = ? AND stage = ?",
            (t_id, STAGE_GROUP),
        ).fetchone()
        if existing["c"] > 0 and not regenerate:
            raise ValueError("Ya hay fixture generado. Pasá regenerate=True.")
        if regenerate:
            conn.execute(
                "DELETE FROM matches WHERE tournament_id = ? AND stage = ? AND status = 'scheduled'",
                (t_id, STAGE_GROUP),
            )

    by_group: dict[str, List[dict]] = {}
    for p in players:
        by_group.setdefault(p["group_label"], []).append(p)

    with db.get_conn() as conn:
        for label in sorted(by_group.keys()):
            grupo = by_group[label]
            pairs = round_robin_pairs([p["id"] for p in grupo])
            for round_idx, round_pairs in enumerate(pairs, start=1):
                for home_id, away_id in round_pairs:
                    conn.execute(
                        """
                        INSERT INTO matches (
                            tournament_id, stage, round_number, group_label,
                            home_player_id, away_player_id, status
                        ) VALUES (?, ?, ?, ?, ?, ?, 'scheduled')
                        """,
                        (t_id, STAGE_GROUP, round_idx, label, home_id, away_id),
                    )
            if t["double_round"]:
                # Segunda vuelta invertida
                offset = len(pairs)
                for round_idx, round_pairs in enumerate(pairs, start=1):
                    for home_id, away_id in round_pairs:
                        conn.execute(
                            """
                            INSERT INTO matches (
                                tournament_id, stage, round_number, group_label,
                                home_player_id, away_player_id, status
                            ) VALUES (?, ?, ?, ?, ?, ?, 'scheduled')
                            """,
                            (t_id, STAGE_GROUP, round_idx + offset, label, away_id, home_id),
                        )
    return list_matches(t_id)


def generate_league_fixture(t_id: str, regenerate: bool = False) -> List[dict]:
    """Liga de todos contra todos sobre todos los participantes."""
    t = get_tournament(t_id)
    if not t:
        raise ValueError("Torneo no encontrado")
    if t["format"] != FORMAT_LEAGUE:
        raise ValueError("Solo aplica a formato 'league'")
    players = list_players(t_id)

    with db.get_conn() as conn:
        existing = conn.execute(
            "SELECT COUNT(*) AS c FROM matches WHERE tournament_id = ?",
            (t_id,),
        ).fetchone()
        if existing["c"] > 0 and not regenerate:
            raise ValueError("Ya hay fixture. Pasá regenerate=True.")
        if regenerate:
            conn.execute(
                "DELETE FROM matches WHERE tournament_id = ? AND status = 'scheduled'",
                (t_id,),
            )

        pairs = round_robin_pairs([p["id"] for p in players])
        for round_idx, round_pairs in enumerate(pairs, start=1):
            for home_id, away_id in round_pairs:
                conn.execute(
                    """
                    INSERT INTO matches (
                        tournament_id, stage, round_number,
                        home_player_id, away_player_id, status
                    ) VALUES (?, ?, ?, ?, ?, 'scheduled')
                    """,
                    (t_id, "league", round_idx, home_id, away_id),
                )
        if t["double_round"]:
            offset = len(pairs)
            for round_idx, round_pairs in enumerate(pairs, start=1):
                for home_id, away_id in round_pairs:
                    conn.execute(
                        """
                        INSERT INTO matches (
                            tournament_id, stage, round_number,
                            home_player_id, away_player_id, status
                        ) VALUES (?, ?, ?, ?, ?, 'scheduled')
                        """,
                        (t_id, "league", round_idx + offset, away_id, home_id),
                    )
        conn.execute(
            "UPDATE tournaments SET status = ? WHERE id = ?",
            (STATUS_GROUPS, t_id),
        )
    return list_matches(t_id)


# ──────────────────────────────────────────────────────────────
# Partidos
# ──────────────────────────────────────────────────────────────
def list_matches(t_id: str, stage: Optional[str] = None) -> List[dict]:
    query = "SELECT * FROM matches WHERE tournament_id = ?"
    params: list = [t_id]
    if stage:
        query += " AND stage = ?"
        params.append(stage)
    query += " ORDER BY stage, round_number, id"
    with db.get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]


def get_match(match_id: int) -> Optional[dict]:
    with db.get_conn() as conn:
        row = conn.execute("SELECT * FROM matches WHERE id = ?", (match_id,)).fetchone()
        return dict(row) if row else None


def set_match_result(match_id: int, home_score: int, away_score: int) -> dict:
    if home_score < 0 or away_score < 0 or home_score > 99 or away_score > 99:
        raise ValueError("Scores deben estar entre 0 y 99")
    match = get_match(match_id)
    if not match:
        raise ValueError("Partido no encontrado")
    if match["home_player_id"] is None or match["away_player_id"] is None:
        raise ValueError(
            "Partido sin jugadores asignados. Resolvé ronda anterior primero."
        )
    now = _now()
    with db.get_conn() as conn:
        conn.execute(
            """
            UPDATE matches
            SET home_score = ?, away_score = ?, status = 'played', played_at = ?
            WHERE id = ?
            """,
            (home_score, away_score, now, match_id),
        )
    # Si el partido era de bracket, propagamos ganador al siguiente slot.
    _propagate_bracket_winner(match_id)
    return get_match(match_id)


def clear_match_result(match_id: int) -> dict:
    match = get_match(match_id)
    if not match:
        raise ValueError("Partido no encontrado")
    with db.get_conn() as conn:
        conn.execute(
            """
            UPDATE matches
            SET home_score = NULL, away_score = NULL, status = 'scheduled',
                played_at = NULL
            WHERE id = ?
            """,
            (match_id,),
        )
        # Invalidar slots dependientes del bracket
        conn.execute(
            """
            UPDATE matches
            SET home_player_id = NULL, away_player_id = NULL,
                home_score = NULL, away_score = NULL, status = 'scheduled'
            WHERE tournament_id = ?
              AND (slot_home = ? OR slot_away = ?)
            """,
            (
                match["tournament_id"],
                f"W{match['id']}",
                f"W{match['id']}",
            ),
        )
    return get_match(match_id)


# ──────────────────────────────────────────────────────────────
# Standings
# ──────────────────────────────────────────────────────────────
def compute_standings(t_id: str) -> List[dict]:
    """Calcula la tabla de posiciones (por grupo si aplica)."""
    t = get_tournament(t_id)
    if not t:
        raise ValueError("Torneo no encontrado")
    players = list_players(t_id)
    matches = list_matches(t_id)

    # Estadísticas por jugador
    stats: dict[int, dict] = {
        p["id"]: {
            "player_id": p["id"],
            "display_name": p["display_name"],
            "team_name": p["team_name"],
            "team_ovr": p["team_ovr"],
            "photo_filename": p["photo_filename"],
            "group_label": p["group_label"],
            "pj": 0, "pg": 0, "pe": 0, "pp": 0,
            "gf": 0, "gc": 0, "dif": 0, "pts": 0,
        }
        for p in players
    }

    pts_w = t["points_win"]
    pts_d = t["points_draw"]
    pts_l = t["points_loss"]

    for m in matches:
        if m["stage"] not in (STAGE_GROUP, "league"):
            continue
        if m["status"] != "played":
            continue
        h_id, a_id = m["home_player_id"], m["away_player_id"]
        if h_id not in stats or a_id not in stats:
            continue
        h, a = stats[h_id], stats[a_id]
        h["pj"] += 1; a["pj"] += 1
        h["gf"] += m["home_score"]; h["gc"] += m["away_score"]
        a["gf"] += m["away_score"]; a["gc"] += m["home_score"]
        if m["home_score"] > m["away_score"]:
            h["pg"] += 1; a["pp"] += 1
            h["pts"] += pts_w; a["pts"] += pts_l
        elif m["home_score"] < m["away_score"]:
            a["pg"] += 1; h["pp"] += 1
            a["pts"] += pts_w; h["pts"] += pts_l
        else:
            h["pe"] += 1; a["pe"] += 1
            h["pts"] += pts_d; a["pts"] += pts_d

    for s in stats.values():
        s["dif"] = s["gf"] - s["gc"]

    def sort_key(s: dict):
        # orden: pts desc, dif desc, gf desc, nombre asc
        return (-s["pts"], -s["dif"], -s["gf"], s["display_name"].casefold())

    standings = sorted(stats.values(), key=sort_key)
    # Posición dentro del grupo (si hay grupos)
    pos_counters: dict[Optional[str], int] = {}
    for s in standings:
        key = s["group_label"]
        pos_counters.setdefault(key, 0)
        pos_counters[key] += 1
        s["group_position"] = pos_counters[key]
    return standings


def group_complete(t_id: str) -> bool:
    matches = list_matches(t_id, stage=STAGE_GROUP)
    if not matches:
        matches = list_matches(t_id, stage="league")
    if not matches:
        return False
    return all(m["status"] == "played" for m in matches)


# ──────────────────────────────────────────────────────────────
# Bracket / Eliminatoria
# ──────────────────────────────────────────────────────────────
def advance_to_knockout(t_id: str, regenerate: bool = False) -> List[dict]:
    """
    Toma los K primeros de cada grupo y arma los cruces de eliminatoria.

    Los slots se rotulan como ``A1``, ``B2``, etc. y se cruzan así:
    A1 vs B2, B1 vs A2, C1 vs D2, D1 vs C2, ... (patrón estándar mundialista).
    """
    t = get_tournament(t_id)
    if not t:
        raise ValueError("Torneo no encontrado")
    if t["format"] != FORMAT_GROUPS_KO:
        raise ValueError("Solo aplica a formato 'groups_knockout'")
    if not group_complete(t_id):
        raise ValueError("Todavía quedan partidos de grupo por jugar")

    k = t["qualify_per_group"]
    g = t["num_groups"]
    qualifiers_total = g * k
    if qualifiers_total < 2:
        raise ValueError("Clasificados insuficientes")

    # Verificar potencia de 2 para bracket simple (padding con BYE si no).
    # Implementación simple: requerimos potencia de 2.
    if qualifiers_total & (qualifiers_total - 1) != 0:
        raise ValueError(
            f"Cantidad de clasificados ({qualifiers_total}) debe ser potencia de 2 "
            f"(4, 8, 16, 32)."
        )

    # Standings para resolver qué player_id corresponde a cada slot.
    standings = compute_standings(t_id)
    slot_to_player: dict[str, int] = {}
    for s in standings:
        if s["group_label"] and s["group_position"] <= k:
            slot_to_player[f"{s['group_label']}{s['group_position']}"] = s["player_id"]

    if len(slot_to_player) != qualifiers_total:
        raise ValueError(
            f"Esperaba {qualifiers_total} clasificados, encontré {len(slot_to_player)}"
        )

    with db.get_conn() as conn:
        existing_ko = conn.execute(
            """
            SELECT COUNT(*) AS c FROM matches
            WHERE tournament_id = ?
              AND stage IN ('round_of_16','quarter','semi','final','third_place')
            """,
            (t_id,),
        ).fetchone()
        if existing_ko["c"] > 0 and not regenerate:
            raise ValueError("Bracket ya generado. Pasá regenerate=True.")
        if regenerate:
            conn.execute(
                """
                DELETE FROM matches
                WHERE tournament_id = ?
                  AND stage IN ('round_of_16','quarter','semi','final','third_place')
                """,
                (t_id,),
            )

        # Generar árbol de eliminatoria con los slots.
        bracket = knockout_bracket(list(slot_to_player.keys()), num_groups=g, qualify_per_group=k)
        # bracket es lista de rondas, cada ronda es lista de (slot_home, slot_away)
        for round_idx, round_matches in enumerate(bracket):
            stage = _stage_for_round(len(bracket), round_idx)
            for pos, (slot_h, slot_a) in enumerate(round_matches):
                home_id = slot_to_player.get(slot_h) if round_idx == 0 else None
                away_id = slot_to_player.get(slot_a) if round_idx == 0 else None
                conn.execute(
                    """
                    INSERT INTO matches (
                        tournament_id, stage, round_number,
                        home_player_id, away_player_id,
                        slot_home, slot_away, bracket_position, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
                    """,
                    (
                        t_id, stage, round_idx + 1,
                        home_id, away_id,
                        slot_h, slot_a, pos,
                    ),
                )
        conn.execute(
            "UPDATE tournaments SET status = ? WHERE id = ?",
            (STATUS_KNOCKOUT, t_id),
        )
    return list_matches(t_id)


def _stage_for_round(total_rounds: int, round_idx: int) -> str:
    """Mapea índice de ronda (0-based) a etapa, desde la primera."""
    # Ej. total=4 → R16, QF, SF, F. total=3 → QF, SF, F. total=2 → SF, F. total=1 → F.
    stages = [STAGE_R16, STAGE_QUARTER, STAGE_SEMI, STAGE_FINAL]
    start = 4 - total_rounds  # índice en la lista
    return stages[start + round_idx]


def _propagate_bracket_winner(match_id: int) -> None:
    """Cuando se carga un resultado de bracket, llenamos el siguiente match."""
    match = get_match(match_id)
    if not match or match["status"] != "played":
        return
    if match["stage"] not in (STAGE_R16, STAGE_QUARTER, STAGE_SEMI):
        return
    winner = (
        match["home_player_id"]
        if match["home_score"] > match["away_score"]
        else match["away_player_id"]
    )
    # Buscar el match siguiente donde slot_home o slot_away == "W{match_id}"
    slot_key = f"W{match['id']}"
    with db.get_conn() as conn:
        conn.execute(
            """
            UPDATE matches
            SET home_player_id = ?
            WHERE tournament_id = ? AND slot_home = ?
            """,
            (winner, match["tournament_id"], slot_key),
        )
        conn.execute(
            """
            UPDATE matches
            SET away_player_id = ?
            WHERE tournament_id = ? AND slot_away = ?
            """,
            (winner, match["tournament_id"], slot_key),
        )
        # Cerrar torneo si final jugada
        if match["stage"] == STAGE_FINAL:
            conn.execute(
                "UPDATE tournaments SET status = ? WHERE id = ?",
                (STATUS_FINISHED, match["tournament_id"]),
            )
