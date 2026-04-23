"""
Registros públicos de participantes.

Flujo:
1. Usuario entra a ``/`` y se inscribe con nombre + email → crea una fila
   en ``registrations`` con ``status='pending'``.
2. Admin ve todos los inscriptos en `/admin`, puede eliminar.
3. Admin crea un sorteo pasando la lista. El endpoint marca las filas
   usadas como ``status='used'`` y apunta a ``used_in_sorteo_id``.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from . import db


STATUS_PENDING = "pending"
STATUS_USED = "used"
STATUS_REMOVED = "removed"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_email(e: str) -> str:
    return e.strip().lower()


def register(name: str, email: str, notes: Optional[str] = None) -> dict:
    """
    Crea un nuevo registro pending. Dedupe por email:
    - Si ya existe pending con ese email → error (evita duplicados).
    - Si existe como used/removed → se permite crear uno nuevo pending
      reemplazando el anterior.
    """
    name = name.strip()
    if not name:
        raise ValueError("Nombre requerido")
    if len(name) > 50:
        raise ValueError("Nombre demasiado largo (máx 50)")
    if "@" not in email or "." not in email.split("@")[-1]:
        raise ValueError("Email inválido")
    if len(email) > 120:
        raise ValueError("Email demasiado largo (máx 120)")
    email = _normalize_email(email)

    new_id: int
    with db.get_conn() as conn:
        existing = conn.execute(
            "SELECT id, status FROM registrations WHERE email = ?",
            (email,),
        ).fetchone()
        if existing:
            if existing["status"] == STATUS_PENDING:
                raise ValueError(
                    "Ya hay un registro pendiente con ese email"
                )
            # Si estaba used/removed lo reciclamos.
            conn.execute(
                """
                UPDATE registrations
                SET name = ?, status = ?, notes = ?, created_at = ?,
                    used_in_sorteo_id = NULL
                WHERE id = ?
                """,
                (name, STATUS_PENDING, notes, _now(), existing["id"]),
            )
            new_id = existing["id"]
        else:
            cur = conn.execute(
                """
                INSERT INTO registrations (name, email, created_at, status, notes)
                VALUES (?, ?, ?, ?, ?)
                """,
                (name, email, _now(), STATUS_PENDING, notes),
            )
            new_id = int(cur.lastrowid)
    # Commit ocurrió al salir del with — recién ahora get() ve el cambio.
    return get(new_id)


def get(reg_id: int) -> Optional[dict]:
    with db.get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM registrations WHERE id = ?", (reg_id,)
        ).fetchone()
        return dict(row) if row else None


def list_all(status: Optional[str] = None) -> List[dict]:
    query = "SELECT * FROM registrations"
    params: list = []
    if status:
        query += " WHERE status = ?"
        params.append(status)
    query += " ORDER BY created_at ASC"
    with db.get_conn() as conn:
        return [dict(r) for r in conn.execute(query, params).fetchall()]


def list_pending() -> List[dict]:
    return list_all(status=STATUS_PENDING)


def count_pending() -> int:
    with db.get_conn() as conn:
        r = conn.execute(
            "SELECT COUNT(*) AS c FROM registrations WHERE status = ?",
            (STATUS_PENDING,),
        ).fetchone()
        return int(r["c"])


def remove(reg_id: int) -> None:
    with db.get_conn() as conn:
        conn.execute(
            "UPDATE registrations SET status = ? WHERE id = ?",
            (STATUS_REMOVED, reg_id),
        )


def mark_used(emails: List[str], sorteo_id: str) -> int:
    """Marca registros como usados para un sorteo. Devuelve cant actualizada."""
    if not emails:
        return 0
    placeholders = ",".join("?" * len(emails))
    params = [STATUS_USED, sorteo_id, STATUS_PENDING, *map(_normalize_email, emails)]
    with db.get_conn() as conn:
        cur = conn.execute(
            f"""
            UPDATE registrations
            SET status = ?, used_in_sorteo_id = ?
            WHERE status = ? AND email IN ({placeholders})
            """,
            params,
        )
        return cur.rowcount or 0
