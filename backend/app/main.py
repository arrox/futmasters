"""
FastAPI — App de sorteo FC 26.

Endpoints:
- GET  /api/teams
- GET  /api/pool?participants=N
- POST /api/sorteo
- GET  /api/sorteo/{id}
- GET  /api/sorteo/{id}/verify
- GET  /api/sorteo/{id}/export?format=csv|json|md
- GET  /api/sorteos?limit&offset
"""
from __future__ import annotations

import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from . import audit, db, export
from .bombos import build_bombos, compute_num_bombos
from .pool_selector import describe_pool, select_effective_pool
from .schemas import (
    PoolResponse,
    SorteoListItem,
    SorteoListResponse,
    SorteoRequest,
    SorteoResponse,
    TeamsResponse,
    VerifyResponse,
)
from .sorteo import available_modes, ejecutar_sorteo
from .teams import TEAMS


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Inicializa la DB al arrancar."""
    db.init_db()
    yield


app = FastAPI(
    title="Sorteo FC 26",
    description="API de sorteo de equipos con auditoría criptográfica",
    version="1.0.0",
    lifespan=lifespan,
)


def _cors_origins() -> List[str]:
    """Orígenes permitidos (localhost + FC26_CORS_ORIGIN opcional)."""
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    extra = os.environ.get("FC26_CORS_ORIGIN")
    if extra:
        origins.extend(o.strip() for o in extra.split(",") if o.strip())
    return origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _team_to_out(t: dict) -> dict:
    """Convierte un team interno al formato de la API (clave ``def``)."""
    return {
        "name": t["name"],
        "type": t["type"],
        "ovr": t["ovr"],
        "att": t["att"],
        "mid": t["mid"],
        "def": t["def"],
        "bombo": t["bombo"],
        "priority": t["priority"],
    }


def _bombo_to_out(b: dict) -> dict:
    return {
        "numero": b["numero"],
        "equipos": [_team_to_out(e) for e in b["equipos"]],
        "ovr_range": b["ovr_range"],
    }


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "timestamp": _now_iso()}


@app.get("/api/teams", response_model=TeamsResponse)
def get_teams() -> dict:
    sorted_teams = sorted((dict(t) for t in TEAMS), key=lambda t: t["priority"])
    return {
        "teams": [_team_to_out(t) for t in sorted_teams],
        "count": len(sorted_teams),
    }


@app.get("/api/pool", response_model=PoolResponse)
def get_pool(participants: int = Query(..., ge=2, le=20)) -> dict:
    pool = select_effective_pool(participants)
    bombos = build_bombos(pool)
    counts = describe_pool(pool)
    modes = available_modes(participants, compute_num_bombos(participants))
    return {
        "participants": participants,
        "pool": [_team_to_out(t) for t in pool],
        "clubs_count": counts["clubs_count"],
        "nations_count": counts["nations_count"],
        "bombos": [_bombo_to_out(b) for b in bombos],
        "available_modes": modes,
    }


@app.post("/api/sorteo", response_model=SorteoResponse)
def post_sorteo(req: SorteoRequest) -> dict:
    n = len(req.participants)
    num_bombos = compute_num_bombos(n)
    modes = available_modes(n, num_bombos)
    if req.mode not in modes:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Modo '{req.mode}' no disponible para N={n}. "
                f"Modo bombo_equilibrado requiere N múltiplo del número de bombos ({num_bombos})."
            ),
        )

    try:
        resultado = ejecutar_sorteo(req.participants, req.mode, req.seed)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    sorteo_id = str(uuid.uuid4())
    timestamp = _now_iso()

    canonical = audit.build_canonical_payload(
        timestamp=timestamp,
        mode=req.mode,
        seed=req.seed,
        participants=req.participants,
        pool_used=[t["name"] for t in resultado["pool"]],
        bombos=resultado["bombos"],
        assignments=resultado["assignments"],
        groups=resultado["groups"],
    )
    hash_hex = audit.compute_hash(canonical)

    warnings: List[str] = []
    if n < len(TEAMS):
        warnings.append(
            f"Con {n} participantes se usaron {n} equipos del pool de {len(TEAMS)}."
        )

    full_result = {
        "sorteo_id": sorteo_id,
        "timestamp": timestamp,
        "mode": req.mode,
        "seed": req.seed,
        "participants": req.participants,
        "pool": [_team_to_out(t) for t in resultado["pool"]],
        "bombos": [_bombo_to_out(b) for b in resultado["bombos"]],
        "assignments": resultado["assignments"],
        "groups": resultado["groups"],
        "hash": hash_hex,
        "warnings": warnings,
    }

    db.insert_sorteo(
        sorteo_id=sorteo_id,
        timestamp=timestamp,
        mode=req.mode,
        seed=req.seed,
        num_participants=n,
        hash_hex=hash_hex,
        payload_canonical=canonical,
        full_result=full_result,
    )

    return full_result


@app.get("/api/sorteo/{sorteo_id}", response_model=SorteoResponse)
def get_sorteo(sorteo_id: str) -> dict:
    row = db.get_sorteo(sorteo_id)
    if not row:
        raise HTTPException(status_code=404, detail="Sorteo no encontrado")
    return row["full_result"]


@app.get("/api/sorteo/{sorteo_id}/verify", response_model=VerifyResponse)
def verify_sorteo(sorteo_id: str) -> dict:
    row = db.get_sorteo(sorteo_id)
    if not row:
        raise HTTPException(status_code=404, detail="Sorteo no encontrado")
    computed = audit.compute_hash(row["payload_canonical"])
    stored = row["hash"]
    return {
        "sorteo_id": sorteo_id,
        "verified": stored == computed,
        "stored_hash": stored,
        "computed_hash": computed,
    }


@app.get("/api/sorteo/{sorteo_id}/export")
def export_sorteo(sorteo_id: str, format: str = Query("json", pattern="^(csv|json|md)$")):
    row = db.get_sorteo(sorteo_id)
    if not row:
        raise HTTPException(status_code=404, detail="Sorteo no encontrado")
    try:
        content, content_type, filename = export.export(row["full_result"], format)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return Response(
        content=content,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/sorteos", response_model=SorteoListResponse)
def list_sorteos(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> dict:
    items = db.list_sorteos(limit, offset)
    return {
        "total": db.count_sorteos(),
        "limit": limit,
        "offset": offset,
        "items": [SorteoListItem(**i).model_dump() for i in items],
    }
