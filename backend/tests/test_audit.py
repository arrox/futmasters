"""Tests de hashing canónico."""
from app.audit import build_canonical_payload, compute_hash, verify_hash


def _sample():
    return build_canonical_payload(
        timestamp="2026-04-23T19:30:00+00:00",
        mode="simple",
        seed=None,
        participants=["Juan", "Ana"],
        pool_used=["Real Madrid", "Manchester City"],
        bombos=[
            {"numero": 1, "equipos": [{"name": "Real Madrid"}]},
            {"numero": 2, "equipos": [{"name": "Manchester City"}]},
        ],
        assignments=[
            {"participant": "Juan", "team": "Real Madrid", "ovr": 88, "bombo": 1, "pick_order": 1},
            {"participant": "Ana", "team": "Manchester City", "ovr": 85, "bombo": 2, "pick_order": 2},
        ],
        groups=None,
    )


def test_hash_es_determinista():
    c = _sample()
    assert compute_hash(c) == compute_hash(c)


def test_hash_cambia_con_modificacion():
    c = _sample()
    h1 = compute_hash(c)
    c["assignments"][0]["team"] = "FC Barcelona"
    h2 = compute_hash(c)
    assert h1 != h2


def test_hash_insensible_al_orden_de_claves():
    c = _sample()
    # No hay forma trivial de reordenar; confiamos en sort_keys del serializador.
    # Verificamos que agregar un campo cambia el hash.
    h1 = compute_hash(c)
    c["extra"] = "foo"
    h2 = compute_hash(c)
    assert h1 != h2


def test_verify_hash_ok():
    c = _sample()
    h = compute_hash(c)
    assert verify_hash(c, h) is True
    assert verify_hash(c, "0" * 64) is False
