"""
Envío de emails de confirmación de trade.

Si están las env vars SMTP configuradas, usa ``smtplib`` para mandar el mail.
Si no, registra el link en el log y devuelve el detalle para que la UI admin
pueda mostrarlo (modo dev / "magic link").

Env vars reconocidas:
- ``MAIL_SMTP_HOST``  (ej: smtp.gmail.com)
- ``MAIL_SMTP_PORT``  (default 587)
- ``MAIL_SMTP_USER``  (usuario)
- ``MAIL_SMTP_PASSWORD`` (app password)
- ``MAIL_FROM``       (remitente visible)
- ``MAIL_USE_TLS``    ('1' default — STARTTLS)
- ``PUBLIC_BASE_URL`` (para armar los links, ej: https://futmasters.arroxlabs.work)
"""
from __future__ import annotations

import logging
import os
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Optional


log = logging.getLogger("futmasters.mailer")


@dataclass
class DeliveryResult:
    """Resultado del intento de envío (transparente para admin)."""

    sent: bool
    backend: str  # 'smtp' | 'log' | 'error'
    detail: str   # mensaje legible (OK / error / "link en log")


def smtp_configured() -> bool:
    """True si al menos HOST + FROM están seteados."""
    return bool(os.environ.get("MAIL_SMTP_HOST")) and bool(
        os.environ.get("MAIL_FROM")
    )


def public_base_url() -> str:
    return os.environ.get("PUBLIC_BASE_URL", "http://localhost:8110").rstrip("/")


def build_trade_link(token: str) -> str:
    return f"{public_base_url()}/trade/{token}"


def _send_smtp(to_addr: str, subject: str, text: str, html: Optional[str] = None) -> DeliveryResult:
    host = os.environ["MAIL_SMTP_HOST"]
    port = int(os.environ.get("MAIL_SMTP_PORT", "587"))
    user = os.environ.get("MAIL_SMTP_USER") or ""
    password = os.environ.get("MAIL_SMTP_PASSWORD") or ""
    sender = os.environ["MAIL_FROM"]
    use_tls = os.environ.get("MAIL_USE_TLS", "1") == "1"

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to_addr
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    try:
        with smtplib.SMTP(host, port, timeout=20) as s:
            if use_tls:
                s.starttls()
            if user:
                s.login(user, password)
            s.send_message(msg)
        return DeliveryResult(True, "smtp", f"Enviado a {to_addr}")
    except Exception as exc:  # noqa: BLE001
        log.exception("SMTP error enviando a %s", to_addr)
        return DeliveryResult(False, "error", f"SMTP error: {exc}")


def send_trade_email(
    to_addr: str,
    player_name: str,
    counterparty_name: str,
    token: str,
    role: str,  # 'proposer' | 'receiver'
    proposer_team: str,
    receiver_team: str,
    tournament_name: str,
) -> DeliveryResult:
    """Manda el link de confirmación a un participante del trade."""
    link = build_trade_link(token)
    if role == "proposer":
        subject = "[FutMasters] Confirma tu propuesta de intercambio"
        intro = (
            f"Hola {player_name}, propusiste intercambiar tu equipo "
            f"({proposer_team}) con {counterparty_name} ({receiver_team})."
        )
    else:
        subject = f"[FutMasters] {counterparty_name} te propone un intercambio"
        intro = (
            f"Hola {player_name}, {counterparty_name} te propone intercambiar "
            f"su equipo ({proposer_team}) por el tuyo ({receiver_team})."
        )
    text = (
        f"{intro}\n\n"
        f"Torneo: {tournament_name}\n"
        f"Para confirmar, abre este enlace:\n\n  {link}\n\n"
        f"El enlace expira en 48 horas. Si no reconoces esta propuesta, "
        f"ignora este mensaje.\n\n"
        f"— FutMasters"
    )
    html = f"""\
    <div style="font-family:Inter,system-ui,sans-serif;color:#222;max-width:540px">
      <h2 style="color:#7a5c1e">FutMasters · Intercambio</h2>
      <p>{intro}</p>
      <p><b>Torneo:</b> {tournament_name}</p>
      <p>Para confirmar, haz clic aquí:</p>
      <p>
        <a href="{link}" style="display:inline-block;padding:12px 20px;
           background:linear-gradient(180deg,#fff1c1,#f0c460 25%,#b8862e 75%,#8a5a1a);
           color:#2a1e08;text-decoration:none;border-radius:4px;font-weight:700;
           letter-spacing:0.08em;text-transform:uppercase;font-size:13px">
          Confirmar intercambio
        </a>
      </p>
      <p style="color:#666;font-size:12px">
        O copia este enlace en tu navegador: <br>
        <code>{link}</code>
      </p>
      <p style="color:#888;font-size:11px">
        El enlace expira en 48 horas. Si no reconoces esta propuesta, ignora
        este mensaje.
      </p>
    </div>
    """
    if not smtp_configured():
        log.info("[magic-link %s] %s → %s", role, to_addr, link)
        return DeliveryResult(
            False,
            "log",
            f"SMTP no configurado. Link: {link}",
        )
    return _send_smtp(to_addr, subject, text, html)


def render_trade_link_for_admin(token: str) -> str:
    """Para que el admin vea/copie el link aunque el email se haya mandado."""
    return build_trade_link(token)


def send_welcome_email(
    to_addr: str,
    player_name: str,
    team_name: str,
    team_ovr: int,
    tournament_name: str,
) -> DeliveryResult:
    """Email de bienvenida al participante tras la creación del torneo."""
    base = public_base_url()
    subject = f"[FutMasters] Bienvenido a {tournament_name}"
    text = (
        f"Hola {player_name},\n\n"
        f"Fuiste incluido en el torneo {tournament_name}.\n"
        f"Tu equipo asignado: {team_name} (OVR {team_ovr}).\n\n"
        f"Para ingresar al sistema visita {base}.\n"
        f"Cloudflare enviará un código de 6 dígitos a este correo ({to_addr}) "
        f"para verificar tu identidad. Ingresa el código cuando te lo solicite "
        f"y listo.\n\n"
        f"¿Quieres cambiar de equipo con alguien? Desde la página del torneo "
        f"puedes proponer intercambios. Tú confirmas con tu enlace, tu "
        f"contraparte también, y el administrador autoriza el cambio final.\n\n"
        f"Saludos — FutMasters"
    )
    html = f"""\
    <div style="font-family:Inter,system-ui,sans-serif;color:#222;max-width:560px">
      <h2 style="color:#7a5c1e;margin-top:0">FutMasters · Bienvenido</h2>
      <p>Hola <b>{player_name}</b>,</p>
      <p>Fuiste incluido en el torneo <b>{tournament_name}</b>.</p>
      <p style="background:#fff7e0;border:1px solid #f0c460;padding:12px;border-radius:6px">
        Tu equipo asignado: <b>{team_name}</b> · OVR <b>{team_ovr}</b>
      </p>
      <h3 style="margin-bottom:4px">Cómo ingresar al sistema</h3>
      <ol>
        <li>Abre <a href="{base}">{base}</a></li>
        <li>Cloudflare te pedirá tu correo y enviará un código de 6 dígitos
            a <b>{to_addr}</b>.</li>
        <li>Ingresa el código y listo — ya estás dentro.</li>
      </ol>
      <h3 style="margin-bottom:4px">Cambiar de equipo</h3>
      <p>Desde la página del torneo puedes proponer intercambios con otros
         participantes. Tú confirmas con tu enlace, tu contraparte también, y
         el administrador autoriza el cambio final.</p>
      <p style="color:#888;font-size:12px;margin-top:20px">
        Si no reconoces este mensaje, ignóralo.
      </p>
    </div>
    """
    if not smtp_configured():
        log.info("[welcome] %s → %s", to_addr, base)
        return DeliveryResult(
            False, "log",
            f"SMTP no configurado. URL: {base}",
        )
    return _send_smtp(to_addr, subject, text, html)
