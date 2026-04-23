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
    """Crea las tablas si no existen."""
    with _init_lock:
        with get_conn() as conn:
            conn.executescript(
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
                );
                CREATE INDEX IF NOT EXISTS idx_sorteos_timestamp
                    ON sorteos(timestamp DESC);

                CREATE TABLE IF NOT EXISTS tournaments (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    sorteo_id TEXT,
                    format TEXT NOT NULL,  -- 'groups_knockout' | 'league'
                    status TEXT NOT NULL,  -- 'draft'|'groups'|'knockout'|'finished'
                    num_groups INTEGER NOT NULL DEFAULT 0,
                    qualify_per_group INTEGER NOT NULL DEFAULT 0,
                    points_win INTEGER NOT NULL DEFAULT 3,
                    points_draw INTEGER NOT NULL DEFAULT 1,
                    points_loss INTEGER NOT NULL DEFAULT 0,
                    double_round INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(sorteo_id) REFERENCES sorteos(id)
                );
                CREATE INDEX IF NOT EXISTS idx_tournaments_created
                    ON tournaments(created_at DESC);

                CREATE TABLE IF NOT EXISTS players (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tournament_id TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    team_name TEXT NOT NULL,
                    team_type TEXT NOT NULL,
                    team_ovr INTEGER NOT NULL,
                    team_att INTEGER NOT NULL,
                    team_mid INTEGER NOT NULL,
                    team_def INTEGER NOT NULL,
                    bombo INTEGER NOT NULL,
                    pick_order INTEGER NOT NULL,
                    group_label TEXT,
                    photo_filename TEXT,
                    email TEXT,
                    FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_players_tournament
                    ON players(tournament_id);

                CREATE TABLE IF NOT EXISTS trades (
                    id TEXT PRIMARY KEY,
                    tournament_id TEXT NOT NULL,
                    proposer_id INTEGER NOT NULL,
                    receiver_id INTEGER NOT NULL,
                    proposer_token TEXT NOT NULL UNIQUE,
                    receiver_token TEXT NOT NULL UNIQUE,
                    proposer_confirmed_at TEXT,
                    receiver_confirmed_at TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                        -- 'pending' | 'confirmed' | 'executed' | 'cancelled' | 'expired'
                    message TEXT,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    executed_at TEXT,
                    cancelled_at TEXT,
                    cancelled_by TEXT,  -- 'proposer' | 'receiver' | 'admin'
                    delivery_notes TEXT, -- JSON con status de envío por participante
                    FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
                    FOREIGN KEY(proposer_id) REFERENCES players(id),
                    FOREIGN KEY(receiver_id) REFERENCES players(id)
                );
                CREATE INDEX IF NOT EXISTS idx_trades_tournament
                    ON trades(tournament_id);
                CREATE INDEX IF NOT EXISTS idx_trades_tokens
                    ON trades(proposer_token, receiver_token);

                CREATE TABLE IF NOT EXISTS matches (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tournament_id TEXT NOT NULL,
                    stage TEXT NOT NULL,  -- 'group'|'round_of_16'|'quarter'|'semi'|'final'|'third_place'
                    round_number INTEGER NOT NULL DEFAULT 0,
                    group_label TEXT,
                    home_player_id INTEGER,
                    away_player_id INTEGER,
                    home_score INTEGER,
                    away_score INTEGER,
                    status TEXT NOT NULL DEFAULT 'scheduled',  -- 'scheduled'|'played'
                    played_at TEXT,
                    slot_home TEXT,  -- para bracket: ganador de match_X, clasificado A1, etc.
                    slot_away TEXT,
                    bracket_position INTEGER,
                    FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
                    FOREIGN KEY(home_player_id) REFERENCES players(id),
                    FOREIGN KEY(away_player_id) REFERENCES players(id)
                );
                CREATE INDEX IF NOT EXISTS idx_matches_tournament
                    ON matches(tournament_id);
                CREATE INDEX IF NOT EXISTS idx_matches_stage
                    ON matches(tournament_id, stage, round_number);

                CREATE TABLE IF NOT EXISTS registrations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                        -- 'pending' | 'used' | 'removed'
                    used_in_sorteo_id TEXT,
                    notes TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_registrations_status
                    ON registrations(status);
                """
            )
            # Migraciones in-place para DBs creadas con schema anterior.
            _ensure_column(conn, "players", "email", "TEXT")


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


def _ensure_column(conn: sqlite3.Connection, table: str, col: str, decl: str) -> None:
    """ALTER TABLE ADD COLUMN si no existe. SQLite-safe."""
    cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
    if col not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")
