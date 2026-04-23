"""Tests de registros públicos."""
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_registro_publico(client):
    r = client.post(
        "/api/registrations",
        json={"name": "Juan", "email": "juan@test.com"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "pending"
    assert data["email"] == "juan@test.com"


def test_registro_dedupe(client):
    client.post(
        "/api/registrations",
        json={"name": "Juan", "email": "x@test.com"},
    )
    r = client.post(
        "/api/registrations",
        json={"name": "Juan2", "email": "X@TEST.COM"},
    )
    assert r.status_code == 400


def test_registro_email_invalido(client):
    r = client.post(
        "/api/registrations", json={"name": "x", "email": "no-email"}
    )
    assert r.status_code == 422


def test_count_publico(client):
    for i in range(3):
        client.post(
            "/api/registrations",
            json={"name": f"P{i}", "email": f"p{i}@test.com"},
        )
    assert client.get("/api/registrations/count").json()["pending"] == 3


def test_admin_lista_y_elimina(client):
    client.post(
        "/api/registrations",
        json={"name": "X", "email": "x@a.com"},
    )
    r = client.get("/api/admin/registrations").json()
    assert len(r) == 1
    reg_id = r[0]["id"]
    client.delete(f"/api/admin/registrations/{reg_id}")
    r2 = client.get("/api/admin/registrations?status=pending").json()
    assert len(r2) == 0


def test_sorteo_marca_registros_como_usados(client):
    client.post(
        "/api/registrations",
        json={"name": "Juan", "email": "juan@test.com"},
    )
    client.post(
        "/api/registrations",
        json={"name": "Pedro", "email": "pedro@test.com"},
    )
    # Admin hace un sorteo con esos emails
    sorteo = client.post(
        "/api/sorteo",
        json={
            "participants": [
                {"name": "Juan", "email": "juan@test.com"},
                {"name": "Pedro", "email": "pedro@test.com"},
            ],
            "mode": "simple",
            "seed": 1,
        },
    ).json()
    regs = client.get("/api/admin/registrations").json()
    used = [r for r in regs if r["status"] == "used"]
    assert len(used) == 2
    assert all(r["used_in_sorteo_id"] == sorteo["sorteo_id"] for r in used)


def test_reciclar_registro_removido(client):
    client.post("/api/registrations", json={"name": "Juan", "email": "z@test.com"})
    reg_id = client.get("/api/admin/registrations").json()[0]["id"]
    client.delete(f"/api/admin/registrations/{reg_id}")
    # Nuevo registro con mismo email debe funcionar
    r = client.post(
        "/api/registrations",
        json={"name": "Juan", "email": "z@test.com"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "pending"
