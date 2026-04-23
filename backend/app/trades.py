"""
Lógica de intercambios (trades) entre participantes.

Un trade requiere que:
1. Quien propone (``proposer``) ingrese el email registrado de su jugador.
2. Quien recibe (``receiver``) confirme desde su link de email.
3. Cuando ambos confirmaron, se hace un swap atómico de equipos y bombo
   entre ``proposer_id`` y ``receiver_id``.

Tokens: se generan dos URL-safe para identificar a cada rol, usando
``secrets.token_urlsafe(24)``. Expiración default 48h.
"""
from __future__ import annotations

import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from . import db, mailer


TRADE_TTL_HOURS = 48

STATUS_PENDING = "pending"        # faltan firmas de jugadores
STATUS_CONFIRMED = "confirmed"    # firmó solo uno (intermedio)
STATUS_AWAITING_ADMIN = "awaiting_admin"  # ambos firmaron, falta admin
STATUS_EXECUTED = "executed"      # swap aplicado
STATUS_CANCELLED = "cancelled"
STATUS_EXPIRED = "expired"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _normalize_email(e: str) -> str:
    return (e or "").strip().lower()


def _get_player(pid: int) -> Optional[dict]:
    from . import tournament
    return tournament.get_player(pid)


def _get_tournament(t_id: str) -> Optional[dict]:
    from . import tournament
    return tournament.get_tournament(t_id)


def _get_trade_row(**kwargs) -> Optional[dict]:
    """Carga un trade por id o por token. Espera una sola clave."""
    assert len(kwargs) == 1
    key, value = next(iter(kwargs.items()))
    with db.get_conn() as conn:
        row = conn.execute(
            f"SELECT * FROM trades WHERE {key} = ?", (value,)
        ).fetchone()
        return dict(row) if row else None


def _expire_if_due(trade: dict) -> dict:
    """Marca el trade como expirado si pasó el ttl. Devuelve la versión actualizada."""
    if trade["status"] in (STATUS_PENDING, STATUS_CONFIRMED):
        try:
            exp = datetime.fromisoformat(trade["expires_at"])
        except Exception:
            return trade
        if _now() > exp:
            with db.get_conn() as conn:
                conn.execute(
                    "UPDATE trades SET status = ? WHERE id = ?",
                    (STATUS_EXPIRED, trade["id"]),
                )
            trade = dict(trade)
            trade["status"] = STATUS_EXPIRED
    return trade


# ──────────────────────────────────────────────────────────────
# Creación
# ──────────────────────────────────────────────────────────────
def propose_trade(
    tournament_id: str,
    proposer_id: int,
    receiver_id: int,
    proposer_email: str,
    message: Optional[str] = None,
) -> dict:
    """
    Crea un trade pendiente. Valida emails del proposer, que no haya trades
    activos entre ellos, y manda los mails (o devuelve los links si no hay SMTP).
    """
    if proposer_id == receiver_id:
        raise ValueError("No podés intercambiar con vos mismo")

    proposer = _get_player(proposer_id)
    receiver = _get_player(receiver_id)
    t = _get_tournament(tournament_id)
    if not t:
        raise ValueError("Torneo no encontrado")
    if not proposer or not receiver:
        raise ValueError("Participante no encontrado")
    if proposer["tournament_id"] != tournament_id or receiver["tournament_id"] != tournament_id:
        raise ValueError("Los participantes deben ser del mismo torneo")

    p_email = _normalize_email(proposer["email"] or "")
    r_email = _normalize_email(receiver["email"] or "")
    if not p_email:
        raise ValueError("El proponente no tiene email registrado. Pedile al admin que lo cargue.")
    if not r_email:
        raise ValueError(
            f"{receiver['display_name']} no tiene email registrado; pedile al admin que lo cargue."
        )
    if _normalize_email(proposer_email) != p_email:
        raise ValueError("El email ingresado no coincide con el registrado")

    # Evitar duplicados activos entre los mismos jugadores
    with db.get_conn() as conn:
        existing = conn.execute(
            """
            SELECT id FROM trades
            WHERE tournament_id = ?
              AND status IN ('pending','confirmed')
              AND (
                (proposer_id = ? AND receiver_id = ?)
                OR (proposer_id = ? AND receiver_id = ?)
              )
            """,
            (tournament_id, proposer_id, receiver_id, receiver_id, proposer_id),
        ).fetchone()
        if existing:
            raise ValueError("Ya hay un intercambio pendiente entre estos participantes")

    trade_id = str(uuid.uuid4())
    proposer_token = secrets.token_urlsafe(24)
    receiver_token = secrets.token_urlsafe(24)
    created = _now_iso()
    expires = (_now() + timedelta(hours=TRADE_TTL_HOURS)).isoformat()

    # Enviar emails (o loguear magic links)
    delivery: dict = {}
    for role, player, token in (
        ("proposer", proposer, proposer_token),
        ("receiver", receiver, receiver_token),
    ):
        email_target = p_email if role == "proposer" else r_email
        counter = receiver if role == "proposer" else proposer
        res = mailer.send_trade_email(
            to_addr=email_target,
            player_name=player["display_name"],
            counterparty_name=counter["display_name"],
            token=token,
            role=role,
            proposer_team=proposer["team_name"],
            receiver_team=receiver["team_name"],
            tournament_name=t["name"],
        )
        delivery[role] = {
            "sent": res.sent,
            "backend": res.backend,
            "detail": res.detail,
            "email": email_target,
            "link": mailer.render_trade_link_for_admin(token),
        }

    with db.get_conn() as conn:
        conn.execute(
            """
            INSERT INTO trades (
                id, tournament_id, proposer_id, receiver_id,
                proposer_token, receiver_token, status,
                message, created_at, expires_at, delivery_notes
            ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
            """,
            (
                trade_id, tournament_id, proposer_id, receiver_id,
                proposer_token, receiver_token,
                message, created, expires,
                json.dumps(delivery, ensure_ascii=False),
            ),
        )
    return get_trade(trade_id)


# ──────────────────────────────────────────────────────────────
# Lectura
# ──────────────────────────────────────────────────────────────
def _hydrate(trade: dict, include_tokens: bool = False) -> dict:
    """Expande referencias a jugadores y parsea delivery_notes."""
    from . import tournament

    proposer = tournament.get_player(trade["proposer_id"])
    receiver = tournament.get_player(trade["receiver_id"])
    try:
        delivery = json.loads(trade["delivery_notes"]) if trade["delivery_notes"] else {}
    except json.JSONDecodeError:
        delivery = {}

    out = {
        "id": trade["id"],
        "tournament_id": trade["tournament_id"],
        "status": trade["status"],
        "message": trade["message"],
        "created_at": trade["created_at"],
        "expires_at": trade["expires_at"],
        "executed_at": trade["executed_at"],
        "cancelled_at": trade["cancelled_at"],
        "cancelled_by": trade["cancelled_by"],
        "proposer_confirmed_at": trade["proposer_confirmed_at"],
        "receiver_confirmed_at": trade["receiver_confirmed_at"],
        "proposer": _player_summary(proposer),
        "receiver": _player_summary(receiver),
        "delivery": delivery,
    }
    if include_tokens:
        out["proposer_token"] = trade["proposer_token"]
        out["receiver_token"] = trade["receiver_token"]
    return out


def _player_summary(p: Optional[dict]) -> Optional[dict]:
    if not p:
        return None
    return {
        "id": p["id"],
        "display_name": p["display_name"],
        "team_name": p["team_name"],
        "team_type": p["team_type"],
        "team_ovr": p["team_ovr"],
        "bombo": p["bombo"],
        "photo_filename": p["photo_filename"],
        "email_hint": _mask_email(p["email"]),
    }


def _mask_email(email: Optional[str]) -> Optional[str]:
    if not email or "@" not in email:
        return None
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        return f"{local[0]}*@{domain}"
    return f"{local[0]}{'*' * (len(local) - 2)}{local[-1]}@{domain}"


def get_trade(trade_id: str, include_tokens: bool = True) -> Optional[dict]:
    row = _get_trade_row(id=trade_id)
    if not row:
        return None
    row = _expire_if_due(row)
    return _hydrate(row, include_tokens=include_tokens)


def get_trade_by_token(token: str) -> Optional[dict]:
    with db.get_conn() as conn:
        row = conn.execute(
            """
            SELECT * FROM trades
            WHERE proposer_token = ? OR receiver_token = ?
            LIMIT 1
            """,
            (token, token),
        ).fetchone()
    if not row:
        return None
    row = dict(row)
    row = _expire_if_due(row)
    hydrated = _hydrate(row, include_tokens=False)
    hydrated["role"] = (
        "proposer" if row["proposer_token"] == token else "receiver"
    )
    return hydrated


def list_trades(tournament_id: str) -> list[dict]:
    with db.get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM trades WHERE tournament_id = ? ORDER BY created_at DESC",
            (tournament_id,),
        ).fetchall()
    out = []
    for r in rows:
        r = _expire_if_due(dict(r))
        out.append(_hydrate(r, include_tokens=True))
    return out


# ──────────────────────────────────────────────────────────────
# Confirmación y cancelación
# ──────────────────────────────────────────────────────────────
def confirm(token: str) -> dict:
    """
    Confirmación de uno de los dos participantes con su magic-link.

    No ejecuta el swap directamente: cuando firman los dos, el trade pasa a
    ``awaiting_admin`` y espera que el admin pulse "Autorizar" para el swap.
    """
    row = _get_trade_row_by_token_raw(token)
    if not row:
        raise ValueError("Token de trade inválido")
    row = _expire_if_due(row)
    if row["status"] in (STATUS_EXECUTED, STATUS_CANCELLED):
        raise ValueError(f"El intercambio ya está {row['status']}")
    if row["status"] == STATUS_EXPIRED:
        raise ValueError("El intercambio expiró")
    role = "proposer" if row["proposer_token"] == token else "receiver"
    field = f"{role}_confirmed_at"
    if row[field]:
        return get_trade(row["id"])

    now = _now_iso()
    with db.get_conn() as conn:
        conn.execute(
            f"UPDATE trades SET {field} = ? WHERE id = ?",
            (now, row["id"]),
        )

    row = _get_trade_row_by_token_raw(token)
    both_signed = row["proposer_confirmed_at"] and row["receiver_confirmed_at"]
    new_status = STATUS_AWAITING_ADMIN if both_signed else STATUS_CONFIRMED
    with db.get_conn() as conn:
        conn.execute(
            "UPDATE trades SET status = ? WHERE id = ?",
            (new_status, row["id"]),
        )
    return get_trade(row["id"])


def admin_authorize(trade_id: str) -> dict:
    """El admin aprueba un trade con ambas firmas, ejecutando el swap."""
    row = _get_trade_row(id=trade_id)
    if not row:
        raise ValueError("Trade no encontrado")
    row = _expire_if_due(row)
    if row["status"] == STATUS_EXECUTED:
        return get_trade(trade_id)
    if row["status"] in (STATUS_CANCELLED, STATUS_EXPIRED):
        raise ValueError(f"El intercambio está {row['status']}")
    if not (row["proposer_confirmed_at"] and row["receiver_confirmed_at"]):
        raise ValueError(
            "Faltan firmas de los participantes antes de que el admin pueda autorizar"
        )
    _execute_swap(trade_id)
    return get_trade(trade_id)


def cancel(token: str) -> dict:
    """Cancelación por cualquiera de las dos partes con su token."""
    row = _get_trade_row_by_token_raw(token)
    if not row:
        raise ValueError("Token inválido")
    row = _expire_if_due(row)
    if row["status"] in (STATUS_EXECUTED, STATUS_CANCELLED, STATUS_EXPIRED):
        raise ValueError(f"El intercambio está {row['status']}")
    role = "proposer" if row["proposer_token"] == token else "receiver"
    with db.get_conn() as conn:
        conn.execute(
            """
            UPDATE trades
            SET status = ?, cancelled_at = ?, cancelled_by = ?
            WHERE id = ?
            """,
            (STATUS_CANCELLED, _now_iso(), role, row["id"]),
        )
    return get_trade(row["id"])


def admin_cancel(trade_id: str) -> dict:
    row = _get_trade_row(id=trade_id)
    if not row:
        raise ValueError("Trade no encontrado")
    if row["status"] in (STATUS_EXECUTED, STATUS_CANCELLED, STATUS_EXPIRED):
        raise ValueError(f"El intercambio está {row['status']}")
    with db.get_conn() as conn:
        conn.execute(
            """
            UPDATE trades
            SET status = ?, cancelled_at = ?, cancelled_by = 'admin'
            WHERE id = ?
            """,
            (STATUS_CANCELLED, _now_iso(), trade_id),
        )
    return get_trade(trade_id)


def _get_trade_row_by_token_raw(token: str) -> Optional[dict]:
    with db.get_conn() as conn:
        row = conn.execute(
            """
            SELECT * FROM trades
            WHERE proposer_token = ? OR receiver_token = ?
            """,
            (token, token),
        ).fetchone()
        return dict(row) if row else None


# ──────────────────────────────────────────────────────────────
# Swap atómico de equipos
# ──────────────────────────────────────────────────────────────
_SWAP_FIELDS = (
    "team_name", "team_type", "team_ovr",
    "team_att", "team_mid", "team_def", "bombo",
)


def _execute_swap(trade_id: str) -> None:
    """Intercambia equipo + bombo entre los dos participantes en una transacción."""
    with db.get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM trades WHERE id = ?", (trade_id,)
        ).fetchone()
        if not row or row["status"] == STATUS_EXECUTED:
            return
        proposer = conn.execute(
            "SELECT * FROM players WHERE id = ?", (row["proposer_id"],)
        ).fetchone()
        receiver = conn.execute(
            "SELECT * FROM players WHERE id = ?", (row["receiver_id"],)
        ).fetchone()
        if not proposer or not receiver:
            raise ValueError("Jugadores no encontrados")

        # Swap: para cada campo, intercambiar valores.
        def _swap_set(pa: dict, pb: dict) -> tuple[list, list, list, list]:
            a_cols = []
            a_vals = []
            b_cols = []
            b_vals = []
            for f in _SWAP_FIELDS:
                a_cols.append(f"{f} = ?")
                a_vals.append(pb[f])
                b_cols.append(f"{f} = ?")
                b_vals.append(pa[f])
            return a_cols, a_vals, b_cols, b_vals

        ac, av, bc, bv = _swap_set(dict(proposer), dict(receiver))
        conn.execute(
            f"UPDATE players SET {', '.join(ac)} WHERE id = ?",
            (*av, proposer["id"]),
        )
        conn.execute(
            f"UPDATE players SET {', '.join(bc)} WHERE id = ?",
            (*bv, receiver["id"]),
        )
        conn.execute(
            """
            UPDATE trades
            SET status = ?, executed_at = ?
            WHERE id = ?
            """,
            (STATUS_EXECUTED, _now_iso(), trade_id),
        )
