"""Tests end-to-end sobre la API FastAPI."""
import json

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_teams_endpoint(client):
    r = client.get("/api/teams")
    assert r.status_code == 200
    data = r.json()
    assert data["count"] == 20
    assert len(data["teams"]) == 20


def test_pool_n4(client):
    r = client.get("/api/pool?participants=4")
    assert r.status_code == 200
    data = r.json()
    names = [t["name"] for t in data["pool"]]
    assert names == ["Real Madrid", "Manchester City", "Paris Saint-Germain", "FC Barcelona"]
    # 4 bombos de 1 equipo
    assert len(data["bombos"]) == 4
    assert all(len(b["equipos"]) == 1 for b in data["bombos"])
    assert "bombo_equilibrado" in data["available_modes"]


def test_pool_n11(client):
    r = client.get("/api/pool?participants=11")
    data = r.json()
    # Hay 12 clubes en el pool — N=11 usa solo clubes.
    assert data["clubs_count"] == 11
    assert data["nations_count"] == 0
    sizes = [len(b["equipos"]) for b in data["bombos"]]
    assert sizes == [3, 3, 3, 2]


def test_pool_n12(client):
    r = client.get("/api/pool?participants=12")
    data = r.json()
    assert data["clubs_count"] == 12
    assert data["nations_count"] == 0


def test_pool_n15(client):
    r = client.get("/api/pool?participants=15")
    data = r.json()
    # 12 clubes (todos) + 3 selecciones top.
    assert data["clubs_count"] == 12
    assert data["nations_count"] == 3
    sizes = [len(b["equipos"]) for b in data["bombos"]]
    assert sizes == [4, 4, 4, 3]
    # 15 no es múltiplo de 4 -> bombo_equilibrado NO disponible
    assert "bombo_equilibrado" not in data["available_modes"]


def test_pool_n20(client):
    r = client.get("/api/pool?participants=20")
    data = r.json()
    assert data["clubs_count"] == 12
    assert data["nations_count"] == 8
    sizes = [len(b["equipos"]) for b in data["bombos"]]
    assert sizes == [5, 5, 5, 5]


def test_pool_invalido(client):
    r = client.get("/api/pool?participants=1")
    assert r.status_code == 422


def test_sorteo_simple(client):
    r = client.post(
        "/api/sorteo",
        json={
            "participants": ["Juan", "Pedro", "Maria", "Ana"],
            "mode": "simple",
            "seed": 42,
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["mode"] == "simple"
    assert len(data["assignments"]) == 4
    assert data["hash"]


def test_sorteo_bombo_equilibrado_valido(client):
    r = client.post(
        "/api/sorteo",
        json={
            "participants": [f"P{i}" for i in range(16)],
            "mode": "bombo_equilibrado",
            "seed": 7,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["groups"] is not None
    assert len(data["groups"]) == 4


def test_sorteo_bombo_equilibrado_invalido(client):
    r = client.post(
        "/api/sorteo",
        json={
            "participants": [f"P{i}" for i in range(15)],
            "mode": "bombo_equilibrado",
            "seed": 7,
        },
    )
    assert r.status_code == 400
    assert "múltiplo" in r.json()["detail"] or "multiplo" in r.json()["detail"]


def test_duplicados_case_insensitive(client):
    r = client.post(
        "/api/sorteo",
        json={"participants": ["juan", "JUAN"], "mode": "simple", "seed": None},
    )
    assert r.status_code == 422


def test_nombre_vacio(client):
    r = client.post(
        "/api/sorteo",
        json={"participants": ["juan", "  "], "mode": "simple", "seed": None},
    )
    assert r.status_code == 422


def test_hash_idempotente_con_misma_seed(client):
    body = {
        "participants": [f"P{i}" for i in range(10)],
        "mode": "simple",
        "seed": 999,
    }
    # Cada POST crea un sorteo nuevo con timestamp distinto -> hash distinto.
    # Pero las asignaciones deben coincidir.
    r1 = client.post("/api/sorteo", json=body).json()
    r2 = client.post("/api/sorteo", json=body).json()
    assert [a["team"] for a in r1["assignments"]] == [
        a["team"] for a in r2["assignments"]
    ]


def test_verify_integridad_ok(client):
    r = client.post(
        "/api/sorteo",
        json={"participants": [f"P{i}" for i in range(8)], "mode": "simple", "seed": 10},
    ).json()
    sid = r["sorteo_id"]
    v = client.get(f"/api/sorteo/{sid}/verify").json()
    assert v["verified"] is True
    assert v["stored_hash"] == v["computed_hash"]


def test_verify_detecta_tamper(client, tmp_path, monkeypatch):
    r = client.post(
        "/api/sorteo",
        json={"participants": [f"P{i}" for i in range(4)], "mode": "simple", "seed": 3},
    ).json()
    sid = r["sorteo_id"]

    import sqlite3
    import os
    db_path = os.environ["FC26_DB_PATH"]
    with sqlite3.connect(db_path) as conn:
        row = conn.execute("SELECT payload_json FROM sorteos WHERE id=?", (sid,)).fetchone()
        payload = json.loads(row[0])
        # Modificar una asignación
        payload["assignments"][0]["team"] = "Equipo Hackeado"
        conn.execute(
            "UPDATE sorteos SET payload_json=? WHERE id=?",
            (json.dumps(payload, sort_keys=True, ensure_ascii=False), sid),
        )
        conn.commit()

    v = client.get(f"/api/sorteo/{sid}/verify").json()
    assert v["verified"] is False
    assert v["stored_hash"] != v["computed_hash"]


def test_export_formatos(client):
    r = client.post(
        "/api/sorteo",
        json={"participants": [f"P{i}" for i in range(6)], "mode": "simple", "seed": 1},
    ).json()
    sid = r["sorteo_id"]

    csv_resp = client.get(f"/api/sorteo/{sid}/export?format=csv")
    assert csv_resp.status_code == 200
    assert csv_resp.headers["content-type"].startswith("text/csv")
    assert "participant" in csv_resp.text

    json_resp = client.get(f"/api/sorteo/{sid}/export?format=json")
    assert json_resp.status_code == 200
    assert json.loads(json_resp.text)["sorteo_id"] == sid

    md_resp = client.get(f"/api/sorteo/{sid}/export?format=md")
    assert md_resp.status_code == 200
    assert "Sorteo FC 26" in md_resp.text


def test_listado(client):
    for i in range(3):
        client.post(
            "/api/sorteo",
            json={
                "participants": [f"P{j}" for j in range(4)],
                "mode": "simple",
                "seed": i,
            },
        )
    r = client.get("/api/sorteos?limit=10&offset=0").json()
    assert r["total"] >= 3
    assert len(r["items"]) >= 3
