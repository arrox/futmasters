"""Tests del endpoint de highlight PNG."""
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def _crear_con_resultado(client):
    sorteo = client.post(
        "/api/sorteo",
        json={
            "participants": [{"name": f"P{i}"} for i in range(4)],
            "mode": "simple",
            "seed": 1,
        },
    ).json()
    t = client.post(
        "/api/admin/tournaments",
        json={
            "name": "Copa test",
            "sorteo_id": sorteo["sorteo_id"],
            "format": "knockout",
            "num_groups": 0,
            "qualify_per_group": 0,
        },
    ).json()
    client.post(f"/api/admin/tournaments/{t['id']}/generate-fixture")
    matches = client.get(f"/api/tournaments/{t['id']}").json()["matches"]
    first = next(m for m in matches if m["round_number"] == 1)
    client.patch(
        f"/api/admin/matches/{first['id']}",
        json={"home_score": 3, "away_score": 1},
    )
    return first["id"]


def test_highlight_returns_png(client):
    mid = _crear_con_resultado(client)
    r = client.get(f"/api/matches/{mid}/highlight.png")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    content = r.content
    # PNG signature
    assert content[:8] == b"\x89PNG\r\n\x1a\n"
    # Imagen razonable (>10 KB)
    assert len(content) > 10_000


def test_highlight_404_si_no_jugado(client):
    sorteo = client.post(
        "/api/sorteo",
        json={
            "participants": [{"name": f"P{i}"} for i in range(4)],
            "mode": "simple",
            "seed": 1,
        },
    ).json()
    t = client.post(
        "/api/admin/tournaments",
        json={
            "name": "Copa test",
            "sorteo_id": sorteo["sorteo_id"],
            "format": "knockout",
            "num_groups": 0,
            "qualify_per_group": 0,
        },
    ).json()
    client.post(f"/api/admin/tournaments/{t['id']}/generate-fixture")
    matches = client.get(f"/api/tournaments/{t['id']}").json()["matches"]
    r = client.get(f"/api/matches/{matches[0]['id']}/highlight.png")
    assert r.status_code == 404


def test_highlight_404_match_inexistente(client):
    r = client.get("/api/matches/99999/highlight.png")
    assert r.status_code == 404
