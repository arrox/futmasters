"""Tests end-to-end de torneo: sorteo → grupos → fixture → resultados → bracket."""
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def _crear_sorteo(client, n=16, mode="simple", seed=123):
    """Helper: crea un sorteo. Usa header admin si hay ADMIN_PASSWORD activa."""
    import os
    headers = {}
    pwd = os.environ.get("ADMIN_PASSWORD")
    if pwd:
        headers["Authorization"] = f"Bearer {pwd}"
    return client.post(
        "/api/sorteo",
        json={
            "participants": [f"P{i:02d}" for i in range(n)],
            "mode": mode,
            "seed": seed,
        },
        headers=headers,
    ).json()


def test_crear_torneo_desde_sorteo(client):
    sorteo = _crear_sorteo(client, n=16)
    r = client.post(
        "/api/admin/tournaments",
        json={
            "name": "Copa Test",
            "sorteo_id": sorteo["sorteo_id"],
            "format": "groups_knockout",
            "num_groups": 4,
            "qualify_per_group": 2,
        },
    )
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["name"] == "Copa Test"
    assert t["status"] == "draft"

    # Tiene jugadores
    d = client.get(f"/api/tournaments/{t['id']}").json()
    assert len(d["players"]) == 16


def test_asignar_grupos_y_fixture(client):
    sorteo = _crear_sorteo(client, n=16)
    t = client.post(
        "/api/admin/tournaments",
        json={
            "name": "Copa",
            "sorteo_id": sorteo["sorteo_id"],
            "num_groups": 4,
            "qualify_per_group": 2,
        },
    ).json()

    r = client.post(f"/api/admin/tournaments/{t['id']}/assign-groups")
    assert r.status_code == 200
    players = r.json()
    # 4 grupos de 4 jugadores
    groups = {}
    for p in players:
        groups.setdefault(p["group_label"], []).append(p)
    assert set(groups.keys()) == {"A", "B", "C", "D"}
    for g in groups.values():
        assert len(g) == 4
        bombos = sorted(p["bombo"] for p in g)
        assert bombos == [1, 2, 3, 4]

    # Generar fixture
    r = client.post(f"/api/admin/tournaments/{t['id']}/generate-fixture")
    assert r.status_code == 200
    matches = r.json()
    # round-robin dentro de cada grupo: C(4,2)=6 partidos x 4 grupos = 24
    group_matches = [m for m in matches if m["stage"] == "group"]
    assert len(group_matches) == 24


def test_cargar_resultados_y_standings(client):
    sorteo = _crear_sorteo(client, n=8)
    t = client.post(
        "/api/admin/tournaments",
        json={
            "name": "Copa",
            "sorteo_id": sorteo["sorteo_id"],
            "num_groups": 2,
            "qualify_per_group": 2,
        },
    ).json()
    client.post(f"/api/admin/tournaments/{t['id']}/assign-groups")
    client.post(f"/api/admin/tournaments/{t['id']}/generate-fixture")

    matches = client.get(f"/api/tournaments/{t['id']}").json()["matches"]
    # Cargar un resultado
    m = matches[0]
    r = client.patch(
        f"/api/admin/matches/{m['id']}",
        json={"home_score": 3, "away_score": 1},
    )
    assert r.status_code == 200
    updated = r.json()
    assert updated["home_score"] == 3
    assert updated["status"] == "played"

    standings = client.get(f"/api/tournaments/{t['id']}/standings").json()
    home_row = next(s for s in standings if s["player_id"] == m["home_player_id"])
    away_row = next(s for s in standings if s["player_id"] == m["away_player_id"])
    assert home_row["pts"] == 3
    assert away_row["pts"] == 0
    assert home_row["gf"] == 3
    assert home_row["gc"] == 1
    assert home_row["dif"] == 2


def test_bracket_genera_cruces(client):
    sorteo = _crear_sorteo(client, n=8, seed=5)
    t = client.post(
        "/api/admin/tournaments",
        json={
            "name": "Copa",
            "sorteo_id": sorteo["sorteo_id"],
            "num_groups": 2,
            "qualify_per_group": 2,
        },
    ).json()
    client.post(f"/api/admin/tournaments/{t['id']}/assign-groups")
    client.post(f"/api/admin/tournaments/{t['id']}/generate-fixture")
    # Jugar todos los partidos de grupo con resultados arbitrarios
    detail = client.get(f"/api/tournaments/{t['id']}").json()
    for m in detail["matches"]:
        if m["stage"] == "group":
            # Home gana 1-0 así el orden queda por pick_order
            client.patch(
                f"/api/admin/matches/{m['id']}",
                json={"home_score": 1, "away_score": 0},
            )

    r = client.post(f"/api/admin/tournaments/{t['id']}/advance-knockout")
    assert r.status_code == 200, r.text
    matches = r.json()
    ko = [m for m in matches if m["stage"] in ("semi", "final")]
    # 2 grupos × 2 clasificados = 4 → semis (2) + final (1) = 3 matches
    assert len(ko) == 3


def test_bracket_falla_si_no_potencia_2(client):
    sorteo = _crear_sorteo(client, n=6, mode="simple")
    t = client.post(
        "/api/admin/tournaments",
        json={
            "name": "Copa",
            "sorteo_id": sorteo["sorteo_id"],
            "num_groups": 2,
            "qualify_per_group": 3,  # 2x3 = 6 clasificados, no es potencia de 2
        },
    ).json()
    client.post(f"/api/admin/tournaments/{t['id']}/assign-groups")
    client.post(f"/api/admin/tournaments/{t['id']}/generate-fixture")
    detail = client.get(f"/api/tournaments/{t['id']}").json()
    for m in detail["matches"]:
        if m["stage"] == "group":
            client.patch(
                f"/api/admin/matches/{m['id']}",
                json={"home_score": 1, "away_score": 0},
            )
    r = client.post(f"/api/admin/tournaments/{t['id']}/advance-knockout")
    assert r.status_code == 400
    assert "potencia de 2" in r.json()["detail"]


def test_regenerar_grupos(client):
    sorteo = _crear_sorteo(client, n=8)
    t = client.post(
        "/api/admin/tournaments",
        json={
            "name": "Copa",
            "sorteo_id": sorteo["sorteo_id"],
            "num_groups": 2,
            "qualify_per_group": 2,
        },
    ).json()
    client.post(f"/api/admin/tournaments/{t['id']}/assign-groups")
    # Sin regenerate → error
    r = client.post(f"/api/admin/tournaments/{t['id']}/assign-groups")
    assert r.status_code == 400
    # Con regenerate → ok
    r = client.post(
        f"/api/admin/tournaments/{t['id']}/assign-groups?regenerate=true"
    )
    assert r.status_code == 200


def test_admin_auth_bloquea_sin_password(monkeypatch, client):
    monkeypatch.setenv("ADMIN_PASSWORD", "secreto123")
    r = client.post(
        "/api/admin/tournaments",
        json={"name": "x", "format": "groups_knockout", "num_groups": 4, "qualify_per_group": 2},
    )
    assert r.status_code == 401


def test_admin_auth_con_token_valido(monkeypatch, client):
    monkeypatch.setenv("ADMIN_PASSWORD", "secreto123")
    sorteo = _crear_sorteo(client, n=8)
    r = client.post(
        "/api/admin/tournaments",
        json={
            "name": "Copa",
            "sorteo_id": sorteo["sorteo_id"],
            "num_groups": 2,
            "qualify_per_group": 2,
        },
        headers={"Authorization": "Bearer secreto123"},
    )
    assert r.status_code == 200


def test_login_devuelve_token(monkeypatch, client):
    monkeypatch.setenv("ADMIN_PASSWORD", "p4ss")
    r = client.post("/api/admin/login", json={"password": "p4ss"})
    assert r.status_code == 200
    assert r.json()["token"] == "p4ss"
    assert r.json()["configured"] is True

    bad = client.post("/api/admin/login", json={"password": "wrong"})
    assert bad.status_code == 401


def test_admin_status_sin_password_config(client):
    # sin ADMIN_PASSWORD en el entorno por el autouse fixture
    import os
    os.environ.pop("ADMIN_PASSWORD", None)
    r = client.get("/api/admin/status").json()
    assert r["configured"] is False
