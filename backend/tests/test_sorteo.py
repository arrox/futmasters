"""Tests de los 3 modos de sorteo."""
import pytest

from app.sorteo import (
    MODE_BOMBO_EQUILIBRADO,
    MODE_DRAFT,
    MODE_SIMPLE,
    available_modes,
    ejecutar_sorteo,
)


def _names(pool):
    return [t["name"] for t in pool]


def test_simple_n4_solo_clubes():
    participants = ["A", "B", "C", "D"]
    res = ejecutar_sorteo(participants, MODE_SIMPLE, seed=42)
    assert len(res["assignments"]) == 4
    assert res["groups"] is None
    tipos = [t["type"] for t in res["pool"]]
    assert all(t == "club" for t in tipos)


def test_simple_n15():
    participants = [f"P{i}" for i in range(15)]
    res = ejecutar_sorteo(participants, MODE_SIMPLE, seed=1)
    assert len(res["assignments"]) == 15
    # Todos los participantes presentes
    assert sorted(a["participant"] for a in res["assignments"]) == sorted(participants)
    # Todos los equipos del pool asignados exactamente una vez
    assert sorted(a["team"] for a in res["assignments"]) == sorted(
        _names(res["pool"])
    )


def test_seed_reproducible():
    participants = [f"P{i}" for i in range(10)]
    a = ejecutar_sorteo(participants, MODE_SIMPLE, seed=123)
    b = ejecutar_sorteo(participants, MODE_SIMPLE, seed=123)
    assert [x["team"] for x in a["assignments"]] == [x["team"] for x in b["assignments"]]


def test_sin_seed_probablemente_diferente():
    participants = [f"P{i}" for i in range(10)]
    a = ejecutar_sorteo(participants, MODE_SIMPLE, seed=None)
    resultados = set()
    for _ in range(5):
        r = ejecutar_sorteo(participants, MODE_SIMPLE, seed=None)
        resultados.add(tuple((x["participant"], x["team"]) for x in r["assignments"]))
    # Con 10! permutaciones, casi seguro al menos 2 distintas
    assert len(resultados) > 1


def test_bombo_equilibrado_n16():
    participants = [f"P{i}" for i in range(16)]
    res = ejecutar_sorteo(participants, MODE_BOMBO_EQUILIBRADO, seed=7)
    assert res["groups"] is not None
    assert len(res["groups"]) == 4  # 16 / 4 = 4 grupos
    for grupo in res["groups"]:
        assert len(grupo["integrantes"]) == 4
        bombos_del_grupo = sorted(i["bombo"] for i in grupo["integrantes"])
        assert bombos_del_grupo == [1, 2, 3, 4]


def test_bombo_equilibrado_n20():
    participants = [f"P{i}" for i in range(20)]
    res = ejecutar_sorteo(participants, MODE_BOMBO_EQUILIBRADO, seed=99)
    assert len(res["groups"]) == 5
    for grupo in res["groups"]:
        assert sorted(i["bombo"] for i in grupo["integrantes"]) == [1, 2, 3, 4]


def test_bombo_equilibrado_n15_rechazado():
    participants = [f"P{i}" for i in range(15)]
    with pytest.raises(ValueError):
        ejecutar_sorteo(participants, MODE_BOMBO_EQUILIBRADO, seed=1)


def test_draft_bombos_n15():
    participants = [f"P{i}" for i in range(15)]
    res = ejecutar_sorteo(participants, MODE_DRAFT, seed=5)
    assert len(res["assignments"]) == 15
    # Cada participante exactamente 1 equipo
    assert len({a["participant"] for a in res["assignments"]}) == 15
    # pick_order únicos y en rango
    picks = sorted(a["pick_order"] for a in res["assignments"])
    assert picks == list(range(1, 16))


def test_draft_bombos_asigna_todos_equipos_del_pool():
    participants = [f"P{i}" for i in range(11)]
    res = ejecutar_sorteo(participants, MODE_DRAFT, seed=5)
    assert sorted(a["team"] for a in res["assignments"]) == sorted(_names(res["pool"]))


def test_available_modes_n16():
    modes = available_modes(16, 4)
    assert MODE_SIMPLE in modes
    assert MODE_DRAFT in modes
    assert MODE_BOMBO_EQUILIBRADO in modes


def test_available_modes_n15():
    modes = available_modes(15, 4)
    assert MODE_SIMPLE in modes
    assert MODE_DRAFT in modes
    assert MODE_BOMBO_EQUILIBRADO not in modes


def test_validaciones_n_fuera_de_rango():
    with pytest.raises(ValueError):
        ejecutar_sorteo(["solo"], MODE_SIMPLE, None)
    with pytest.raises(ValueError):
        ejecutar_sorteo([f"P{i}" for i in range(21)], MODE_SIMPLE, None)


def test_modo_invalido():
    with pytest.raises(ValueError):
        ejecutar_sorteo(["A", "B"], "inexistente", None)
