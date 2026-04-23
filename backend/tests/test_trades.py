"""Tests del flujo de intercambio de equipos entre participantes."""
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def _sorteo_y_torneo(client, n=8):
    sorteo = client.post(
        "/api/sorteo",
        json={
            "participants": [f"P{i:02d}" for i in range(n)],
            "mode": "simple",
            "seed": 42,
        },
    ).json()
    t = client.post(
        "/api/admin/tournaments",
        json={
            "name": "Copa",
            "sorteo_id": sorteo["sorteo_id"],
            "num_groups": 2,
            "qualify_per_group": 2,
        },
    ).json()
    return t


def _set_email(client, player_id, email):
    r = client.patch(
        f"/api/admin/players/{player_id}",
        json={"email": email},
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_flujo_trade_completo_hace_swap(client):
    t = _sorteo_y_torneo(client)
    detail = client.get(f"/api/tournaments/{t['id']}").json()
    p1 = detail["players"][0]
    p2 = detail["players"][1]
    team_a = p1["team_name"]
    team_b = p2["team_name"]
    assert team_a != team_b

    _set_email(client, p1["id"], "a@test.com")
    _set_email(client, p2["id"], "b@test.com")

    r = client.post(
        f"/api/tournaments/{t['id']}/trades",
        json={
            "proposer_id": p1["id"],
            "receiver_id": p2["id"],
            "proposer_email": "a@test.com",
        },
    )
    assert r.status_code == 200, r.text
    trade = r.json()
    assert trade["status"] == "pending"
    assert trade["proposer_token"]
    assert trade["receiver_token"]

    # Confirmar proposer
    r1 = client.post(f"/api/trades/{trade['proposer_token']}/confirm").json()
    assert r1["proposer_confirmed_at"] is not None
    assert r1["status"] == "confirmed"

    # Confirmar receiver → queda esperando al admin (NO ejecuta todavía)
    r2 = client.post(f"/api/trades/{trade['receiver_token']}/confirm").json()
    assert r2["status"] == "awaiting_admin"
    assert r2["executed_at"] is None

    # Equipos aún NO se cambiaron
    mid = client.get(f"/api/tournaments/{t['id']}").json()["players"]
    mid_p1 = next(p for p in mid if p["id"] == p1["id"])
    assert mid_p1["team_name"] == team_a

    # Admin autoriza → ejecuta swap
    r3 = client.post(f"/api/admin/trades/{trade['id']}/authorize").json()
    assert r3["status"] == "executed"
    assert r3["executed_at"] is not None

    # Verificar swap real
    updated = client.get(f"/api/tournaments/{t['id']}").json()["players"]
    p1_new = next(p for p in updated if p["id"] == p1["id"])
    p2_new = next(p for p in updated if p["id"] == p2["id"])
    assert p1_new["team_name"] == team_b
    assert p2_new["team_name"] == team_a


def test_admin_no_puede_autorizar_sin_firmas(client):
    t = _sorteo_y_torneo(client)
    pls = client.get(f"/api/tournaments/{t['id']}").json()["players"]
    p1, p2 = pls[0], pls[1]
    _set_email(client, p1["id"], "a@test.com")
    _set_email(client, p2["id"], "b@test.com")
    trade = client.post(
        f"/api/tournaments/{t['id']}/trades",
        json={
            "proposer_id": p1["id"],
            "receiver_id": p2["id"],
            "proposer_email": "a@test.com",
        },
    ).json()
    # Solo firma proposer
    client.post(f"/api/trades/{trade['proposer_token']}/confirm")
    r = client.post(f"/api/admin/trades/{trade['id']}/authorize")
    assert r.status_code == 400
    assert "firma" in r.json()["detail"].lower()


def test_propose_requires_email_match(client):
    t = _sorteo_y_torneo(client)
    pls = client.get(f"/api/tournaments/{t['id']}").json()["players"]
    p1, p2 = pls[0], pls[1]
    _set_email(client, p1["id"], "a@test.com")
    _set_email(client, p2["id"], "b@test.com")

    r = client.post(
        f"/api/tournaments/{t['id']}/trades",
        json={
            "proposer_id": p1["id"],
            "receiver_id": p2["id"],
            "proposer_email": "otro@test.com",
        },
    )
    assert r.status_code == 400
    assert "coincide" in r.json()["detail"].lower()


def test_propose_requires_receiver_email(client):
    t = _sorteo_y_torneo(client)
    pls = client.get(f"/api/tournaments/{t['id']}").json()["players"]
    p1, p2 = pls[0], pls[1]
    _set_email(client, p1["id"], "a@test.com")
    # p2 sin email

    r = client.post(
        f"/api/tournaments/{t['id']}/trades",
        json={
            "proposer_id": p1["id"],
            "receiver_id": p2["id"],
            "proposer_email": "a@test.com",
        },
    )
    assert r.status_code == 400
    assert "email" in r.json()["detail"].lower()


def test_no_puede_intercambiar_consigo_mismo(client):
    t = _sorteo_y_torneo(client)
    pls = client.get(f"/api/tournaments/{t['id']}").json()["players"]
    p1 = pls[0]
    _set_email(client, p1["id"], "x@test.com")

    r = client.post(
        f"/api/tournaments/{t['id']}/trades",
        json={
            "proposer_id": p1["id"],
            "receiver_id": p1["id"],
            "proposer_email": "x@test.com",
        },
    )
    assert r.status_code == 400


def test_no_duplicados_pendientes(client):
    t = _sorteo_y_torneo(client)
    pls = client.get(f"/api/tournaments/{t['id']}").json()["players"]
    p1, p2 = pls[0], pls[1]
    _set_email(client, p1["id"], "a@test.com")
    _set_email(client, p2["id"], "b@test.com")

    body = {
        "proposer_id": p1["id"],
        "receiver_id": p2["id"],
        "proposer_email": "a@test.com",
    }
    client.post(f"/api/tournaments/{t['id']}/trades", json=body)
    r = client.post(f"/api/tournaments/{t['id']}/trades", json=body)
    assert r.status_code == 400
    assert "pendiente" in r.json()["detail"].lower()


def test_cancel_con_token(client):
    t = _sorteo_y_torneo(client)
    pls = client.get(f"/api/tournaments/{t['id']}").json()["players"]
    p1, p2 = pls[0], pls[1]
    _set_email(client, p1["id"], "a@test.com")
    _set_email(client, p2["id"], "b@test.com")
    trade = client.post(
        f"/api/tournaments/{t['id']}/trades",
        json={
            "proposer_id": p1["id"],
            "receiver_id": p2["id"],
            "proposer_email": "a@test.com",
        },
    ).json()
    r = client.post(f"/api/trades/{trade['proposer_token']}/cancel").json()
    assert r["status"] == "cancelled"
    assert r["cancelled_by"] == "proposer"

    # Segunda confirm falla
    bad = client.post(f"/api/trades/{trade['receiver_token']}/confirm")
    assert bad.status_code == 400


def test_admin_cancel(client):
    t = _sorteo_y_torneo(client)
    pls = client.get(f"/api/tournaments/{t['id']}").json()["players"]
    p1, p2 = pls[0], pls[1]
    _set_email(client, p1["id"], "a@test.com")
    _set_email(client, p2["id"], "b@test.com")
    trade = client.post(
        f"/api/tournaments/{t['id']}/trades",
        json={
            "proposer_id": p1["id"],
            "receiver_id": p2["id"],
            "proposer_email": "a@test.com",
        },
    ).json()
    r = client.delete(f"/api/admin/trades/{trade['id']}").json()
    assert r["status"] == "cancelled"
    assert r["cancelled_by"] == "admin"


def test_sorteo_requiere_admin_si_hay_password(monkeypatch, client):
    monkeypatch.setenv("ADMIN_PASSWORD", "secret")
    r = client.post(
        "/api/sorteo",
        json={
            "participants": ["A", "B"],
            "mode": "simple",
            "seed": 1,
        },
    )
    assert r.status_code == 401
    # Con header correcto
    r2 = client.post(
        "/api/sorteo",
        json={
            "participants": ["A", "B"],
            "mode": "simple",
            "seed": 1,
        },
        headers={"Authorization": "Bearer secret"},
    )
    assert r2.status_code == 200


def test_token_invalido(client):
    r = client.get("/api/trades/xxxinvalid")
    assert r.status_code == 404
    r2 = client.post("/api/trades/xxxinvalid/confirm")
    assert r2.status_code == 400


def test_get_trade_by_token_oculta_el_otro(client):
    t = _sorteo_y_torneo(client)
    pls = client.get(f"/api/tournaments/{t['id']}").json()["players"]
    p1, p2 = pls[0], pls[1]
    _set_email(client, p1["id"], "a@test.com")
    _set_email(client, p2["id"], "b@test.com")
    trade = client.post(
        f"/api/tournaments/{t['id']}/trades",
        json={
            "proposer_id": p1["id"],
            "receiver_id": p2["id"],
            "proposer_email": "a@test.com",
        },
    ).json()

    r = client.get(f"/api/trades/{trade['proposer_token']}").json()
    assert r["role"] == "proposer"
    # La respuesta pública no debe contener los tokens
    assert r.get("proposer_token") is None
    assert r.get("receiver_token") is None


def test_email_hint_en_player_summary(client):
    t = _sorteo_y_torneo(client)
    pls = client.get(f"/api/tournaments/{t['id']}").json()["players"]
    _set_email(client, pls[0]["id"], "juan.perez@example.com")
    _set_email(client, pls[1]["id"], "ana@test.com")
    trade = client.post(
        f"/api/tournaments/{t['id']}/trades",
        json={
            "proposer_id": pls[0]["id"],
            "receiver_id": pls[1]["id"],
            "proposer_email": "juan.perez@example.com",
        },
    ).json()
    hint = trade["proposer"]["email_hint"]
    assert hint is not None
    assert "@" in hint
    assert "*" in hint
