"""Tests de selección del pool efectivo."""
import pytest

from app.pool_selector import select_effective_pool, split_pool
from app.teams import TEAMS


def test_split_pool_counts():
    clubs, nations = split_pool()
    # Según el TEAMS actual: 12 clubes + 8 selecciones = 20 equipos.
    assert len(clubs) == 12
    assert len(nations) == 8
    # orden por priority
    assert [c["priority"] for c in clubs] == sorted(c["priority"] for c in clubs)


def test_pool_n2_solo_clubes():
    pool = select_effective_pool(2)
    assert len(pool) == 2
    assert all(t["type"] == "club" for t in pool)
    assert [t["name"] for t in pool] == ["Real Madrid", "Manchester City"]


def test_pool_n4_top_clubes():
    pool = select_effective_pool(4)
    assert [t["name"] for t in pool] == [
        "Real Madrid", "Manchester City", "Paris Saint-Germain", "FC Barcelona"
    ]


def test_pool_n8_ocho_clubes():
    pool = select_effective_pool(8)
    assert len(pool) == 8
    assert all(t["type"] == "club" for t in pool)
    # Primer club fuera del "top 4" que entra es Bayern (priority 7).
    # El 8vo club por priority es Inter de Milán (priority 13).
    assert "Inter de Milán" in [t["name"] for t in pool]


def test_pool_n11_primeros_clubes():
    pool = select_effective_pool(11)
    assert len(pool) == 11
    assert all(t["type"] == "club" for t in pool)


def test_pool_n12_todos_clubes():
    pool = select_effective_pool(12)
    assert len(pool) == 12
    assert all(t["type"] == "club" for t in pool)


def test_pool_n13_clubes_mas_francia():
    pool = select_effective_pool(13)
    names = [t["name"] for t in pool]
    assert sum(1 for t in pool if t["type"] == "club") == 12
    assert sum(1 for t in pool if t["type"] == "nation") == 1
    assert "Francia" in names


def test_pool_n15_tres_selecciones_top():
    pool = select_effective_pool(15)
    assert len(pool) == 15
    assert sum(1 for t in pool if t["type"] == "club") == 12
    selecciones = [t for t in pool if t["type"] == "nation"]
    # priorizadas por priority ASC dentro de selecciones
    assert [s["name"] for s in selecciones] == ["Francia", "España", "Argentina"]


def test_pool_n20_completo():
    pool = select_effective_pool(20)
    assert len(pool) == 20
    assert {t["name"] for t in pool} == {t["name"] for t in TEAMS}


def test_pool_invalido():
    with pytest.raises(ValueError):
        select_effective_pool(0)
    with pytest.raises(ValueError):
        select_effective_pool(21)
