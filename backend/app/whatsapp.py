"""
Notificaciones por WhatsApp usando la REST API de Twilio.

Env vars reconocidas:
- ``TWILIO_ACCOUNT_SID``   (ej: ACxxxxxxxx…)
- ``TWILIO_AUTH_TOKEN``
- ``TWILIO_FROM``          (ej: ``whatsapp:+14155238886`` — número del sandbox)
- ``WHATSAPP_RECIPIENTS``  CSV de números destinatarios (ej: ``whatsapp:+54911...``)
  Cada persona tiene que haber mandado "join <code>" al sandbox antes, o
  estar registrada en una plantilla aprobada (producción).

Sin esas vars, la función ``send_text`` loguea y devuelve ``sent=False``.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import List, Optional

import httpx


log = logging.getLogger("futmasters.whatsapp")

TWILIO_BASE = "https://api.twilio.com/2010-04-01/Accounts"


@dataclass
class SendResult:
    sent: bool
    backend: str   # 'twilio' | 'log' | 'error'
    detail: str
    message_sids: List[str] = field(default_factory=list)


def twilio_configured() -> bool:
    return all(
        os.environ.get(k)
        for k in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM")
    )


def recipients() -> List[str]:
    raw = os.environ.get("WHATSAPP_RECIPIENTS", "")
    return [_normalize(x) for x in raw.split(",") if x.strip()]


def _normalize(num: str) -> str:
    num = num.strip()
    if num and not num.startswith("whatsapp:"):
        num = f"whatsapp:{num}" if num.startswith("+") else f"whatsapp:+{num}"
    return num


def send_text(body: str, to: Optional[List[str]] = None) -> SendResult:
    """
    Manda un mensaje WhatsApp a una lista de destinatarios.

    - ``to`` override opcional; por default usa ``WHATSAPP_RECIPIENTS``.
    - Si Twilio no está configurado → log + devuelve ``sent=False, backend='log'``.
    """
    targets = to if to is not None else recipients()
    if not targets:
        log.info("[wa] sin destinatarios (WHATSAPP_RECIPIENTS vacío)")
        return SendResult(False, "log", "Sin destinatarios configurados")

    if not twilio_configured():
        log.info("[wa] Twilio no configurado. body=%r targets=%s", body[:80], targets)
        return SendResult(
            False, "log",
            f"Twilio no configurado — mensaje {len(body)} chars para {len(targets)} destinos",
        )

    sid = os.environ["TWILIO_ACCOUNT_SID"]
    token = os.environ["TWILIO_AUTH_TOKEN"]
    sender = _normalize(os.environ["TWILIO_FROM"])

    url = f"{TWILIO_BASE}/{sid}/Messages.json"
    message_sids: List[str] = []
    errors: List[str] = []
    with httpx.Client(timeout=15.0) as client:
        for to_num in targets:
            try:
                r = client.post(
                    url,
                    data={"From": sender, "To": to_num, "Body": body},
                    auth=(sid, token),
                )
                if r.status_code >= 400:
                    detail = r.text[:200]
                    log.warning(
                        "twilio %s → %s: %s", to_num, r.status_code, detail,
                    )
                    errors.append(f"{to_num}: HTTP {r.status_code}")
                    continue
                payload = r.json()
                message_sids.append(payload.get("sid", ""))
            except Exception as exc:  # noqa: BLE001
                log.exception("twilio send failed → %s", to_num)
                errors.append(f"{to_num}: {exc}")

    if message_sids and not errors:
        return SendResult(
            True, "twilio",
            f"Enviado a {len(message_sids)} destinatario(s)",
            message_sids=message_sids,
        )
    if message_sids and errors:
        return SendResult(
            True, "twilio",
            f"Enviado parcial: {len(message_sids)} ok, {len(errors)} errores",
            message_sids=message_sids,
        )
    return SendResult(
        False, "error",
        "Todos los envíos fallaron: " + "; ".join(errors[:3]),
    )


# ──────────────────────────────────────────────────────────────
# Mensajes estructurados
# ──────────────────────────────────────────────────────────────
def format_match_result(
    home_name: str,
    away_name: str,
    home_score: int,
    away_score: int,
    tournament_name: str,
    stage_label: str,
    home_team: str = "",
    away_team: str = "",
    highlight_url: Optional[str] = None,
    tournament_url: Optional[str] = None,
) -> str:
    winner = (
        "Empate"
        if home_score == away_score
        else f"Ganó {home_name}"
        if home_score > away_score
        else f"Ganó {away_name}"
    )
    teams = ""
    if home_team and away_team:
        teams = f"\n  {home_team} vs {away_team}"
    lines = [
        f"🏆 *{tournament_name}* · {stage_label}",
        f"⚽ *{home_name}* {home_score} — {away_score} *{away_name}*{teams}",
        f"🎯 {winner}",
    ]
    if highlight_url:
        lines.append(f"🖼️ {highlight_url}")
    if tournament_url:
        lines.append(f"📊 {tournament_url}")
    return "\n".join(lines)


def format_champion(tournament_name: str, champion_name: str, champion_team: str,
                    tournament_url: Optional[str] = None) -> str:
    lines = [
        f"🏆🏆🏆 *¡Campeón de {tournament_name}!* 🏆🏆🏆",
        f"👑 *{champion_name}* — {champion_team}",
    ]
    if tournament_url:
        lines.append(f"📊 {tournament_url}")
    return "\n".join(lines)


def format_trade_executed(
    player_a: str, team_a: str, player_b: str, team_b: str, tournament_name: str,
) -> str:
    return (
        f"🔄 *Intercambio ejecutado en {tournament_name}*\n"
        f"{player_a} ahora juega con {team_b}\n"
        f"{player_b} ahora juega con {team_a}"
    )


def format_tournament_launched(
    tournament_name: str,
    format_label: str,
    num_participants: int,
    assignments: list[dict],
    tournament_url: Optional[str] = None,
) -> str:
    """
    ``assignments`` = lista de {participant, team, ovr} del sorteo.
    """
    lines = [
        f"🏆🏆 *¡Nuevo torneo listo!* 🏆🏆",
        f"📣 *{tournament_name}*",
        f"⚙️ {format_label} · {num_participants} participantes",
        "",
        "*Equipos asignados:*",
    ]
    for a in assignments[:20]:
        ovr = a.get("ovr") or a.get("team_ovr")
        lines.append(
            f"  • {a['participant']} → {a['team']}"
            + (f" ({ovr})" if ovr else "")
        )
    if tournament_url:
        lines.append("")
        lines.append(f"📊 Sigue el torneo: {tournament_url}")
    return "\n".join(lines)
