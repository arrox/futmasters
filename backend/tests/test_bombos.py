"""Tests de armado de bombos."""
import pytest

from app.bombos import build_bombos, compute_bombo_sizes, compute_num_bombos
from app.pool_selector import select_effective_pool


def test_num_bombos_pequeno():
    assert compute_num_bombos(2) == 2
    assert compute_num_bombos(3) == 3


def test_num_bombos_default():
    for n in range(4, 21):
        assert compute_num_bombos(n) == 4


def test_sizes_n15():
    assert compute_bombo_sizes(15) == [4, 4, 4, 3]


def test_sizes_n11():
    assert compute_bombo_sizes(11) == [3, 3, 3, 2]


def test_sizes_n8():
    assert compute_bombo_sizes(8) == [2, 2, 2, 2]


def test_sizes_n20():
    assert compute_bombo_sizes(20) == [5, 5, 5, 5]


def test_sizes_n4():
    assert compute_bombo_sizes(4) == [1, 1, 1, 1]


def test_build_bombos_n15_composicion():
    pool = select_effective_pool(15)
    bombos = build_bombos(pool)
    assert len(bombos) == 4
    # Bombo 1: los 4 mayores OVR del pool (Real Madrid, Man City, PSG, Barcelona, Francia)
    # Ojo: Real Madrid=88; Man City/PSG/Barça/Francia/España=85 → desempate por priority
    b1 = [e["name"] for e in bombos[0]["equipos"]]
    assert b1[0] == "Real Madrid"
    assert len(b1) == 4
    # Bombo 4: los 3 de menor OVR
    b4 = [e["name"] for e in bombos[3]["equipos"]]
    assert len(b4) == 3


def test_build_bombos_n4():
    pool = select_effective_pool(4)
    bombos = build_bombos(pool)
    assert len(bombos) == 4
    assert all(len(b["equipos"]) == 1 for b in bombos)
    assert bombos[0]["equipos"][0]["name"] == "Real Madrid"


def test_build_bombos_n2():
    pool = select_effective_pool(2)
    bombos = build_bombos(pool)
    assert len(bombos) == 2
    assert bombos[0]["equipos"][0]["name"] == "Real Madrid"
    assert bombos[1]["equipos"][0]["name"] == "Manchester City"


def test_ovr_range_ordered():
    pool = select_effective_pool(20)
    bombos = build_bombos(pool)
    # Max OVR de bombo 1 >= max OVR de bombo 2, etc.
    max_ovr = [max(e["ovr"] for e in b["equipos"]) for b in bombos]
    assert max_ovr == sorted(max_ovr, reverse=True)
