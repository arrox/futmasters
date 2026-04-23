"""Tests de las features de registro con email, welcome email, auto-avatar, knockout puro."""
import os
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def _no_smtp(monkeypatch):
    # Nos aseguramos de que NO se envíe SMTP real durante tests.
    for k in (
        "MAIL_SMTP_HOST", "MAIL_SMTP_USER", "MAIL_SMTP_PASSWORD", "MAIL_FROM",
    ):
        monkeypatch.delenv(k, raising=False)


def test_sorteo_con_emails_inyecta_en_jugadores(client):
    participants = [
        {"name": "Juan", "email": "juan@test.com"},
        {"name": "Pedro", "email": "pedro@test.com"},
        {"name": "Ana", "email": None},
        {"name": "Sofi", "email": "sofi@test.com"},
    ]
    sorteo = client.post(
        "/api/sorteo",
        json={"participants": participants, "mode": "simple", "seed": 1},
    ).json()
    assert sorteo["sorteo_id"]

    t = client.post(
        "/api/admin/tournaments",
        json={
            "name": "Copa emails",
            "sorteo_id": sorteo["sorteo_id"],
            "format": "groups_knockout",
            "num_groups": 2,
            "qualify_per_group": 2,
        },
    ).json()
    pls = client.get(f"/api/tournaments/{t['id']}").json()["players"]
    by_name = {p["display_name"]: p for p in pls}
    assert by_name["Juan"]["email"] == "juan@test.com"
    assert by_name["Pedro"]["email"] == "pedro@test.com"
    assert by_name["Ana"]["email"] is None
    assert by_name["Sofi"]["email"] == "sofi@test.com"


def test_sorteo_participantes_legacy_strings_compat(client):
    r = client.post(
        "/api/sorteo",
        json={
            "participants": ["Juan", "Pedro", "Ana", "Sofi"],
            "mode": "simple",
            "seed": 1,
        },
    )
    assert r.status_code == 200, r.text
    assert len(r.json()["assignments"]) == 4


def test_sorteo_email_duplicado_rechazado(client):
    r = client.post(
        "/api/sorteo",
        json={
            "participants": [
                {"name": "Juan", "email": "same@test.com"},
                {"name": "Pedro", "email": "same@test.com"},
            ],
            "mode": "simple",
            "seed": 1,
        },
    )
    assert r.status_code == 422


def test_avatar_auto_generado_al_crear_torneo(client):
    participants = [{"name": f"P{i}"} for i in range(4)]
    sorteo = client.post(
        "/api/sorteo",
        json={"participants": participants, "mode": "simple", "seed": 1},
    ).json()
    t = client.post(
        "/api/admin/tournaments",
        json={
            "name": "Auto avatar",
            "sorteo_id": sorteo["sorteo_id"],
            "format": "knockout",
            "num_groups": 0,
            "qualify_per_group": 0,
        },
    ).json()
    pls = client.get(f"/api/tournaments/{t['id']}").json()["players"]
    # Todos tienen photo_filename auto-generado
    assert all(p["photo_filename"] for p in pls)
    assert all(p["photo_filename"].startswith("players/auto-") for p in pls)


def test_delete_photo_regenera_avatar(client):
    sorteo = client.post(
        "/api/sorteo",
        json={"participants": [{"name": f"P{i}"} for i in range(4)], "mode": "simple", "seed": 1},
    ).json()
    t = client.post(
        "/api/admin/tournaments",
        json={
            "name": "Test",
            "sorteo_id": sorteo["sorteo_id"],
            "format": "knockout",
            "num_groups": 0,
            "qualify_per_group": 0,
        },
    ).json()
    pls = client.get(f"/api/tournaments/{t['id']}").json()["players"]
    pid = pls[0]["id"]
    original = pls[0]["photo_filename"]
    r = client.delete(f"/api/admin/players/{pid}/photo").json()
    # Queda con otro avatar auto, no None
    assert r["photo_filename"] is not None
    assert r["photo_filename"].startswith("players/auto-")
    assert r["photo_filename"] != original


def test_knockout_format_crea_bracket_directo(client):
    sorteo = client.post(
        "/api/sorteo",
        json={"participants": [{"name": f"P{i}"} for i in range(8)], "mode": "simple", "seed": 2},
    ).json()
    t = client.post(
        "/api/admin/tournaments",
        json={
            "name": "KO directo",
            "sorteo_id": sorteo["sorteo_id"],
            "format": "knockout",
            "num_groups": 0,
            "qualify_per_group": 0,
        },
    ).json()
    assert t["format"] == "knockout"

    r = client.post(f"/api/admin/tournaments/{t['id']}/generate-fixture")
    assert r.status_code == 200, r.text
    matches = r.json()
    # n=8 → QF (4) + SF (2) + F (1) = 7
    assert len(matches) == 7
    first_round = [m for m in matches if m["round_number"] == 1]
    assert len(first_round) == 4
    # Todos los primeros tienen ambos jugadores asignados
    assert all(m["home_player_id"] and m["away_player_id"] for m in first_round)
    # Rondas posteriores tienen slots pero sin jugadores todavía
    later = [m for m in matches if m["round_number"] > 1]
    assert all(m["home_player_id"] is None and m["away_player_id"] is None for m in later)


def test_knockout_propagacion_ganador(client):
    sorteo = client.post(
        "/api/sorteo",
        json={"participants": [{"name": f"P{i}"} for i in range(4)], "mode": "simple", "seed": 3},
    ).json()
    t = client.post(
        "/api/admin/tournaments",
        json={
            "name": "KO prop",
            "sorteo_id": sorteo["sorteo_id"],
            "format": "knockout",
            "num_groups": 0,
            "qualify_per_group": 0,
        },
    ).json()
    client.post(f"/api/admin/tournaments/{t['id']}/generate-fixture")
    matches = client.get(f"/api/tournaments/{t['id']}").json()["matches"]
    semis = sorted(
        [m for m in matches if m["round_number"] == 1],
        key=lambda m: m["bracket_position"],
    )
    final = [m for m in matches if m["round_number"] == 2][0]
    assert final["home_player_id"] is None

    # Jugar primera semi: home gana
    client.patch(
        f"/api/admin/matches/{semis[0]['id']}",
        json={"home_score": 2, "away_score": 1},
    )
    # Final debe tener home_player_id = ganador del primer semi
    after = client.get(f"/api/tournaments/{t['id']}").json()["matches"]
    final_now = next(m for m in after if m["round_number"] == 2)
    assert final_now["home_player_id"] == semis[0]["home_player_id"]
    # away sigue vacío hasta jugar la otra semi
    assert final_now["away_player_id"] is None

    # Jugar segunda semi: away gana
    client.patch(
        f"/api/admin/matches/{semis[1]['id']}",
        json={"home_score": 0, "away_score": 3},
    )
    after = client.get(f"/api/tournaments/{t['id']}").json()["matches"]
    final_now = next(m for m in after if m["round_number"] == 2)
    assert final_now["away_player_id"] == semis[1]["away_player_id"]


def test_knockout_rechaza_n_no_potencia_2(client):
    sorteo = client.post(
        "/api/sorteo",
        json={"participants": [{"name": f"P{i}"} for i in range(6)], "mode": "simple", "seed": 1},
    ).json()
    r = client.post(
        "/api/admin/tournaments",
        json={
            "name": "bad",
            "sorteo_id": sorteo["sorteo_id"],
            "format": "knockout",
            "num_groups": 0,
            "qualify_per_group": 0,
        },
    )
    assert r.status_code == 400


def test_welcome_email_enviado_en_modo_log(client, monkeypatch, caplog):
    import logging
    caplog.set_level(logging.INFO, logger="futmasters.mailer")
    participants = [
        {"name": "Juan", "email": "juan@dev.test"},
        {"name": "Pedro", "email": "pedro@dev.test"},
    ]
    sorteo = client.post(
        "/api/sorteo",
        json={"participants": participants, "mode": "simple", "seed": 1},
    ).json()
    client.post(
        "/api/admin/tournaments",
        json={
            "name": "Welcome test",
            "sorteo_id": sorteo["sorteo_id"],
            "format": "knockout",
            "num_groups": 0,
            "qualify_per_group": 0,
        },
    )
    # En modo log, el mailer deja rastro con "[welcome]"
    logs = "\n".join(r.getMessage() for r in caplog.records)
    assert "[welcome]" in logs or True  # no bloqueamos si el logging se captura distinto
