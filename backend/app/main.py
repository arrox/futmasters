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
from pathlib import Path
from typing import List

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from . import (
    audit, db, export, highlights, media, registrations, tournament, trades,
    whatsapp as wa,
)
from .admin_auth import admin_password, require_admin
from .bombos import build_bombos, compute_num_bombos
from .pool_selector import describe_pool, select_effective_pool
from .schemas import (
    AdminLoginRequest,
    AdminLoginResponse,
    MatchOut,
    MatchResultIn,
    PlayerOut,
    PlayerUpdate,
    PoolResponse,
    RegistrationCountOut,
    RegistrationCreate,
    RegistrationOut,
    SorteoListItem,
    SorteoListResponse,
    SorteoRequest,
    SorteoResponse,
    StandingRow,
    TeamsResponse,
    TournamentCreate,
    TournamentDetail,
    TournamentOut,
    TournamentUpdate,
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


@app.post(
    "/api/sorteo",
    response_model=SorteoResponse,
    dependencies=[Depends(require_admin)],
)
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

    # El hash canónico se calcula solo sobre nombres + equipo (no sobre emails)
    # para que sea reproducible y no depienda de metadata privada.
    participant_names = [p["name"] for p in resultado["participants_ext"]]
    canonical = audit.build_canonical_payload(
        timestamp=timestamp,
        mode=req.mode,
        seed=req.seed,
        participants=participant_names,
        pool_used=[t["name"] for t in resultado["pool"]],
        bombos=resultado["bombos"],
        assignments=[
            {k: v for k, v in a.items() if k != "email"}
            for a in resultado["assignments"]
        ],
        groups=(
            [
                {
                    "nombre": g["nombre"],
                    "integrantes": [
                        {k: v for k, v in i.items() if k != "email"}
                        for i in g["integrantes"]
                    ],
                }
                for g in resultado["groups"]
            ]
            if resultado["groups"]
            else None
        ),
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
        "participants": participant_names,
        "participants_ext": resultado["participants_ext"],
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

    # Si los participantes provienen de registros públicos, los marcamos usados.
    emails_in_sorteo = [
        a["email"] for a in resultado["assignments"] if a.get("email")
    ]
    if emails_in_sorteo:
        registrations.mark_used(emails_in_sorteo, sorteo_id)

    # Welcome email a cada participante con email registrado. Los errores de
    # envío NO rompen el sorteo — la idea es no perder un sorteo por un mail
    # que falló. El admin puede ver los logs si algo no llegó.
    from . import mailer
    import logging
    _log = logging.getLogger("futmasters.sorteo")
    for a in resultado["assignments"]:
        if not a.get("email"):
            continue
        try:
            res = mailer.send_welcome_email(
                to_addr=a["email"],
                player_name=a["participant"],
                team_name=a["team"],
                team_ovr=a["ovr"],
                tournament_name=f"Sorteo {req.mode} · {timestamp[:10]}",
            )
            _log.info(
                "welcome %s → %s backend=%s sent=%s",
                a["participant"], a["email"], res.backend, res.sent,
            )
        except Exception as exc:  # noqa: BLE001
            _log.exception(
                "welcome email failed for %s (%s): %s",
                a["participant"], a["email"], exc,
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


@app.get("/api/matches/{match_id}/highlight.png")
def match_highlight_png(match_id: int):
    """Imagen compartible del partido (para WhatsApp/OG preview)."""
    try:
        png = highlights.render_match_highlight(
            match_id,
            media_dir=media.media_dir(),
            public_url=os.environ.get("PUBLIC_BASE_URL", ""),
        )
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    return Response(
        content=png,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=300",
            "Content-Disposition": f'inline; filename="match-{match_id}.png"',
        },
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


# ──────────────────────────────────────────────────────────────
# Torneos: estado público (sin auth)
# ──────────────────────────────────────────────────────────────
def _tournament_detail(t_id: str) -> dict:
    t = tournament.get_tournament(t_id)
    if not t:
        raise HTTPException(status_code=404, detail="Torneo no encontrado")
    players = tournament.list_players(t_id)
    matches = tournament.list_matches(t_id)
    standings = tournament.compute_standings(t_id)
    return {
        "tournament": {**t, "double_round": bool(t["double_round"])},
        "players": players,
        "matches": matches,
        "standings": standings,
    }


@app.get("/api/tournaments", response_model=list[TournamentOut])
def list_tournaments_endpoint():
    return [
        {**t, "double_round": bool(t["double_round"])}
        for t in tournament.list_tournaments()
    ]


@app.get("/api/tournaments/{t_id}", response_model=TournamentDetail)
def get_tournament_detail(t_id: str):
    return _tournament_detail(t_id)


@app.get(
    "/api/tournaments/{t_id}/standings", response_model=list[StandingRow]
)
def get_standings(t_id: str):
    t = tournament.get_tournament(t_id)
    if not t:
        raise HTTPException(404, "Torneo no encontrado")
    return tournament.compute_standings(t_id)


# ──────────────────────────────────────────────────────────────
# Admin: auth
# ──────────────────────────────────────────────────────────────
@app.get("/api/admin/status", response_model=AdminLoginResponse)
def admin_status():
    pwd = admin_password()
    return {
        "token": "",
        "configured": bool(pwd),
    }


@app.get(
    "/api/admin/whatsapp/status",
    dependencies=[Depends(require_admin)],
)
def admin_whatsapp_status():
    return {
        "configured": wa.twilio_configured(),
        "recipients_count": len(wa.recipients()),
    }


@app.post(
    "/api/admin/whatsapp/test",
    dependencies=[Depends(require_admin)],
)
def admin_whatsapp_test(body: dict | None = None):
    text = (body or {}).get("text") or (
        "🏆 FutMasters — prueba de WhatsApp. Si ves este mensaje, la "
        "integración con Twilio está funcionando."
    )
    result = wa.send_text(text)
    return {
        "sent": result.sent,
        "backend": result.backend,
        "detail": result.detail,
        "message_sids": result.message_sids,
    }


@app.post("/api/admin/login", response_model=AdminLoginResponse)
def admin_login(req: AdminLoginRequest):
    pwd = admin_password()
    if not pwd:
        # Si no hay password en el entorno, devolvemos token vacío: dev mode.
        return {"token": "", "configured": False}
    import hmac as _hmac
    if not _hmac.compare_digest(req.password, pwd):
        raise HTTPException(status_code=401, detail="Password inválido")
    return {"token": pwd, "configured": True}


# ──────────────────────────────────────────────────────────────
# Admin: torneos
# ──────────────────────────────────────────────────────────────
@app.post(
    "/api/admin/tournaments",
    response_model=TournamentOut,
    dependencies=[Depends(require_admin)],
)
def admin_create_tournament(req: TournamentCreate):
    try:
        if req.sorteo_id:
            t = tournament.create_from_sorteo(
                sorteo_id=req.sorteo_id,
                name=req.name,
                fmt=req.format,
                num_groups=req.num_groups,
                qualify_per_group=req.qualify_per_group,
                double_round=req.double_round,
            )
        else:
            t = tournament.create_tournament(
                name=req.name,
                sorteo_id=None,
                fmt=req.format,
                num_groups=req.num_groups,
                qualify_per_group=req.qualify_per_group,
                double_round=req.double_round,
            )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {**t, "double_round": bool(t["double_round"])}


@app.patch(
    "/api/admin/tournaments/{t_id}",
    response_model=TournamentOut,
    dependencies=[Depends(require_admin)],
)
def admin_update_tournament(t_id: str, req: TournamentUpdate):
    if not tournament.get_tournament(t_id):
        raise HTTPException(404, "Torneo no encontrado")
    updated = tournament.update_tournament(t_id, **req.model_dump(exclude_unset=True))
    return {**updated, "double_round": bool(updated["double_round"])}


@app.delete(
    "/api/admin/tournaments/{t_id}",
    dependencies=[Depends(require_admin)],
)
def admin_delete_tournament(t_id: str):
    if not tournament.get_tournament(t_id):
        raise HTTPException(404, "Torneo no encontrado")
    tournament.delete_tournament(t_id)
    return {"deleted": t_id}


@app.post(
    "/api/admin/tournaments/{t_id}/assign-groups",
    response_model=list[PlayerOut],
    dependencies=[Depends(require_admin)],
)
def admin_assign_groups(t_id: str, regenerate: bool = False):
    try:
        return tournament.assign_groups(t_id, regenerate=regenerate)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.post(
    "/api/admin/tournaments/{t_id}/generate-fixture",
    response_model=list[MatchOut],
    dependencies=[Depends(require_admin)],
)
def admin_generate_fixture(t_id: str, regenerate: bool = False):
    t = tournament.get_tournament(t_id)
    if not t:
        raise HTTPException(404, "Torneo no encontrado")
    try:
        if t["format"] == tournament.FORMAT_LEAGUE:
            return tournament.generate_league_fixture(t_id, regenerate=regenerate)
        if t["format"] == tournament.FORMAT_KNOCKOUT:
            return tournament.generate_knockout_fixture(t_id, regenerate=regenerate)
        return tournament.generate_group_fixture(t_id, regenerate=regenerate)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.post(
    "/api/admin/tournaments/{t_id}/advance-knockout",
    response_model=list[MatchOut],
    dependencies=[Depends(require_admin)],
)
def admin_advance_knockout(t_id: str, regenerate: bool = False):
    try:
        return tournament.advance_to_knockout(t_id, regenerate=regenerate)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.patch(
    "/api/admin/matches/{match_id}",
    response_model=MatchOut,
    dependencies=[Depends(require_admin)],
)
def admin_set_match_result(match_id: int, req: MatchResultIn):
    try:
        return tournament.set_match_result(match_id, req.home_score, req.away_score)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.delete(
    "/api/admin/matches/{match_id}/result",
    response_model=MatchOut,
    dependencies=[Depends(require_admin)],
)
def admin_clear_match_result(match_id: int):
    try:
        return tournament.clear_match_result(match_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.patch(
    "/api/admin/players/{player_id}",
    response_model=PlayerOut,
    dependencies=[Depends(require_admin)],
)
def admin_update_player(player_id: int, req: PlayerUpdate):
    if not tournament.get_player(player_id):
        raise HTTPException(404, "Jugador no encontrado")
    return tournament.update_player(
        player_id,
        **{k: v for k, v in req.model_dump(exclude_unset=True).items() if v is not None},
    )


@app.post(
    "/api/admin/players/{player_id}/photo",
    response_model=PlayerOut,
    dependencies=[Depends(require_admin)],
)
async def admin_upload_player_photo(
    player_id: int, file: UploadFile = File(...)
):
    player = tournament.get_player(player_id)
    if not player:
        raise HTTPException(404, "Jugador no encontrado")
    try:
        from io import BytesIO
        data = await file.read()
        filename = media.save_player_photo(
            BytesIO(data), file.filename or "photo.jpg", file.content_type
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    # Borrar foto previa si existía
    if player["photo_filename"]:
        media.delete_player_photo(player["photo_filename"])
    return tournament.update_player(player_id, photo_filename=filename)


@app.delete(
    "/api/admin/players/{player_id}/photo",
    response_model=PlayerOut,
    dependencies=[Depends(require_admin)],
)
def admin_delete_player_photo(player_id: int):
    """Borra la foto real y la reemplaza por un avatar auto-generado."""
    player = tournament.get_player(player_id)
    if not player:
        raise HTTPException(404, "Jugador no encontrado")
    if player["photo_filename"]:
        media.delete_player_photo(player["photo_filename"])
    try:
        auto = media.generate_avatar_for(player["display_name"])
    except Exception:  # noqa: BLE001
        auto = None
    return tournament.update_player(player_id, photo_filename=auto)


# ──────────────────────────────────────────────────────────────
# Registros públicos (self-service) + gestión admin
# ──────────────────────────────────────────────────────────────
@app.post("/api/registrations", response_model=RegistrationOut)
def public_register(req: RegistrationCreate):
    try:
        return registrations.register(req.name, req.email, req.notes)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.get("/api/registrations/count", response_model=RegistrationCountOut)
def public_count_registrations():
    return {"pending": registrations.count_pending()}


@app.get(
    "/api/admin/registrations",
    response_model=list[RegistrationOut],
    dependencies=[Depends(require_admin)],
)
def admin_list_registrations(
    status: str | None = Query(default=None),
):
    if status and status not in ("pending", "used", "removed"):
        raise HTTPException(400, "status inválido")
    return registrations.list_all(status=status)


@app.delete(
    "/api/admin/registrations/{reg_id}",
    dependencies=[Depends(require_admin)],
)
def admin_delete_registration(reg_id: int):
    if not registrations.get(reg_id):
        raise HTTPException(404, "Registro no encontrado")
    registrations.remove(reg_id)
    return {"removed": reg_id}


# ──────────────────────────────────────────────────────────────
# Intercambios (trades) entre participantes
# ──────────────────────────────────────────────────────────────
from .schemas import TradeOut, TradeProposeRequest  # noqa: E402


@app.post("/api/tournaments/{t_id}/trades", response_model=TradeOut)
def create_trade(t_id: str, req: TradeProposeRequest):
    try:
        trade = trades.propose_trade(
            tournament_id=t_id,
            proposer_id=req.proposer_id,
            receiver_id=req.receiver_id,
            proposer_email=req.proposer_email,
            message=req.message,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    # No filtramos delivery para el proposer inicial: así ve su propio link
    # si SMTP está en modo log. (En producción lo oculta el frontend cuando
    # la backend = 'smtp'.)
    return trade


@app.get("/api/trades/{token}", response_model=TradeOut)
def get_trade_by_token_endpoint(token: str):
    trade = trades.get_trade_by_token(token)
    if not trade:
        raise HTTPException(404, "Trade no encontrado")
    # Para el público, NO devolvemos los tokens del otro lado ni delivery.
    public = {k: v for k, v in trade.items() if k not in ("delivery",)}
    return public


@app.post("/api/trades/{token}/confirm", response_model=TradeOut)
def confirm_trade(token: str):
    try:
        trade = trades.confirm(token)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {k: v for k, v in trade.items() if k not in ("delivery",)}


@app.post("/api/trades/{token}/cancel", response_model=TradeOut)
def cancel_trade(token: str):
    try:
        trade = trades.cancel(token)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {k: v for k, v in trade.items() if k not in ("delivery",)}


@app.get(
    "/api/admin/tournaments/{t_id}/trades",
    response_model=list[TradeOut],
    dependencies=[Depends(require_admin)],
)
def admin_list_trades(t_id: str):
    if not tournament.get_tournament(t_id):
        raise HTTPException(404, "Torneo no encontrado")
    return trades.list_trades(t_id)


@app.delete(
    "/api/admin/trades/{trade_id}",
    response_model=TradeOut,
    dependencies=[Depends(require_admin)],
)
def admin_cancel_trade(trade_id: str):
    try:
        return trades.admin_cancel(trade_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.post(
    "/api/admin/trades/{trade_id}/authorize",
    response_model=TradeOut,
    dependencies=[Depends(require_admin)],
)
def admin_authorize_trade(trade_id: str):
    try:
        return trades.admin_authorize(trade_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


# ──────────────────────────────────────────────────────────────
# Media estática (fotos de jugadores)
# ──────────────────────────────────────────────────────────────
app.mount(
    "/media",
    StaticFiles(directory=str(media.media_dir())),
    name="media",
)


# ──────────────────────────────────────────────────────────────
# Servir el frontend built (single-port deploy detrás del tunnel).
# Si la carpeta dist/ no existe (entorno dev), se omite silenciosamente.
# ──────────────────────────────────────────────────────────────
_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if _DIST.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=str(_DIST / "assets")),
        name="assets",
    )

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str):
        """Sirve el index.html para rutas del SPA; 404 para /api no matcheadas."""
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        candidate = _DIST / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_DIST / "index.html")
