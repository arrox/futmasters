"""
Capa de persistencia SQLite para sorteos.

Usamos ``sqlite3`` de la stdlib con parametrización en todas las queries
para evitar inyección SQL. La columna ``payload_json`` guarda el payload
canónico exacto para poder re-calcular el hash en el endpoint de verify.
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, List, Optional


DB_PATH_ENV = "FC26_DB_PATH"
DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "fc26_sorteo.db"


_init_lock = threading.Lock()


def _db_path() -> Path:
    """Resuelve el path de la DB respetando env var."""
    override = os.environ.get(DB_PATH_ENV)
    if override:
        return Path(override)
    return DEFAULT_DB_PATH


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    """Context manager de conexión SQLite con row_factory."""
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    """Crea la tabla ``sorteos`` si no existe."""
    with _init_lock:
        with get_conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS sorteos (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    mode TEXT NOT NULL,
                    seed INTEGER,
                    num_participants INTEGER NOT NULL,
                    hash TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    full_result_json TEXT NOT NULL
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_sorteos_timestamp ON sorteos(timestamp DESC)"
            )


def insert_sorteo(
    sorteo_id: str,
    timestamp: str,
    mode: str,
    seed: Optional[int],
    num_participants: int,
    hash_hex: str,
    payload_canonical: dict,
    full_result: dict,
) -> None:
    """Inserta un sorteo en la DB."""
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO sorteos (
                id, timestamp, mode, seed, num_participants,
                hash, payload_json, full_result_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                sorteo_id,
                timestamp,
                mode,
                seed,
                num_participants,
                hash_hex,
                json.dumps(payload_canonical, sort_keys=True, ensure_ascii=False),
                json.dumps(full_result, ensure_ascii=False),
            ),
        )


def get_sorteo(sorteo_id: str) -> Optional[dict]:
    """Devuelve un sorteo por ID o None."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM sorteos WHERE id = ?", (sorteo_id,)
        ).fetchone()
        if not row:
            return None
        return _row_to_dict(row)


def list_sorteos(limit: int, offset: int) -> List[dict]:
    """Lista sorteos paginados por timestamp DESC."""
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, timestamp, mode, seed, num_participants, hash
            FROM sorteos
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()
        return [dict(r) for r in rows]


def count_sorteos() -> int:
    """Total de sorteos en DB."""
    with get_conn() as conn:
        row = conn.execute("SELECT COUNT(*) AS c FROM sorteos").fetchone()
        return int(row["c"])


def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["payload_canonical"] = json.loads(d.pop("payload_json"))
    d["full_result"] = json.loads(d.pop("full_result_json"))
    return d
