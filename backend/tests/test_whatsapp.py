"""Tests del módulo whatsapp y de su integración."""
import pytest
from fastapi.testclient import TestClient

from app import whatsapp as wa
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_send_text_log_mode_sin_twilio(monkeypatch):
    for k in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("WHATSAPP_RECIPIENTS", "+5491123456789")
    res = wa.send_text("hola")
    assert res.sent is False
    assert res.backend == "log"


def test_send_text_sin_destinatarios(monkeypatch):
    monkeypatch.delenv("WHATSAPP_RECIPIENTS", raising=False)
    res = wa.send_text("hola")
    assert res.sent is False
    assert "destinatarios" in res.detail.lower()


def test_format_match_result_basic():
    body = wa.format_match_result(
        home_name="Juan", away_name="Ana",
        home_score=3, away_score=1,
        tournament_name="Copa test",
        stage_label="Semifinal",
        home_team="Real Madrid", away_team="Barcelona",
    )
    assert "Juan" in body and "Ana" in body
    assert "3 — 1" in body
    assert "Ganó Juan" in body


def test_format_match_result_empate():
    body = wa.format_match_result(
        home_name="Juan", away_name="Ana",
        home_score=2, away_score=2,
        tournament_name="Copa",
        stage_label="Grupo A · Fecha 1",
    )
    assert "Empate" in body


def test_format_champion():
    body = wa.format_champion(
        tournament_name="Copa", champion_name="Juan",
        champion_team="Real Madrid",
        tournament_url="https://example.com/t/1",
    )
    assert "Campeón" in body
    assert "Juan" in body
    assert "Real Madrid" in body


def test_format_tournament_launched():
    body = wa.format_tournament_launched(
        tournament_name="Copa 2026",
        format_label="Grupos + eliminación directa",
        num_participants=8,
        assignments=[
            {"participant": "Juan", "team": "Real Madrid", "ovr": 88},
            {"participant": "Ana", "team": "Barcelona", "ovr": 85},
        ],
        tournament_url="https://example.com/t/xyz",
    )
    assert "Juan → Real Madrid (88)" in body
    assert "Ana → Barcelona (85)" in body
    assert "example.com/t/xyz" in body


def test_send_text_con_twilio_mock(monkeypatch):
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "ACtestsid")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "faketoken")
    monkeypatch.setenv("TWILIO_FROM", "whatsapp:+14155238886")
    monkeypatch.setenv("WHATSAPP_RECIPIENTS", "+5491123456789")

    import httpx
    from unittest.mock import MagicMock

    # Mock del cliente httpx
    posted = []

    class FakeResponse:
        status_code = 201
        def json(self):
            return {"sid": "SM12345"}
        @property
        def text(self):
            return "ok"

    class FakeClient:
        def __init__(self, **kw): pass
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def post(self, url, data=None, auth=None):
            posted.append({"url": url, "data": data, "auth": auth})
            return FakeResponse()

    monkeypatch.setattr(httpx, "Client", FakeClient)

    res = wa.send_text("test")
    assert res.sent is True
    assert res.backend == "twilio"
    assert res.message_sids == ["SM12345"]
    assert len(posted) == 1
    assert posted[0]["data"]["From"] == "whatsapp:+14155238886"
    assert posted[0]["data"]["To"] == "whatsapp:+5491123456789"
    assert posted[0]["data"]["Body"] == "test"


def test_admin_whatsapp_status_endpoint(client, monkeypatch):
    monkeypatch.delenv("TWILIO_ACCOUNT_SID", raising=False)
    r = client.get("/api/admin/whatsapp/status").json()
    assert r["configured"] is False
    assert r["recipients_count"] == 0

    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "t")
    monkeypatch.setenv("TWILIO_FROM", "whatsapp:+1")
    monkeypatch.setenv("WHATSAPP_RECIPIENTS", "+1,+2,+3")
    r2 = client.get("/api/admin/whatsapp/status").json()
    assert r2["configured"] is True
    assert r2["recipients_count"] == 3


def test_admin_whatsapp_test_sin_config(client, monkeypatch):
    for k in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.delenv("WHATSAPP_RECIPIENTS", raising=False)
    r = client.post("/api/admin/whatsapp/test", json={"text": "x"}).json()
    assert r["sent"] is False
    assert r["backend"] == "log"
