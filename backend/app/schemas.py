"""Schemas Pydantic v2 para request/response de la API."""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator  # noqa: F401


Mode = Literal["simple", "bombo_equilibrado", "draft_bombos"]


class TeamOut(BaseModel):
    """Equipo tal como se expone en /api/teams y /api/pool."""

    name: str
    type: Literal["club", "nation"]
    ovr: int
    att: int
    mid: int
    def_: int = Field(alias="def")
    bombo: int
    priority: int

    model_config = {"populate_by_name": True}


class BombosPreview(BaseModel):
    numero: int
    equipos: List[TeamOut]
    ovr_range: str


class PoolResponse(BaseModel):
    participants: int
    pool: List[TeamOut]
    clubs_count: int
    nations_count: int
    bombos: List[BombosPreview]
    available_modes: List[Mode]


class TeamsResponse(BaseModel):
    teams: List[TeamOut]
    count: int


class ParticipantInput(BaseModel):
    """Un participante a sortear: nombre + email opcional."""

    name: str = Field(min_length=1, max_length=50)
    email: Optional[str] = Field(default=None, max_length=120)

    @field_validator("name")
    @classmethod
    def _clean_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Nombre vacío")
        return v

    @field_validator("email")
    @classmethod
    def _clean_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Email inválido")
        return v.lower()


class SorteoRequest(BaseModel):
    """
    Request del sorteo. ``participants`` acepta strings (compat legado)
    o objetos ``{name, email}``.
    """

    participants: List  # validado abajo
    mode: Mode
    seed: Optional[int] = None

    @field_validator("participants")
    @classmethod
    def _validate_participants(cls, v: list) -> List[dict]:
        if not isinstance(v, list) or not (2 <= len(v) <= 20):
            raise ValueError("Cantidad de participantes debe estar entre 2 y 20")
        cleaned: List[dict] = []
        seen_names = set()
        seen_emails = set()
        for raw in v:
            if isinstance(raw, str):
                parsed = ParticipantInput(name=raw)
            elif isinstance(raw, dict):
                parsed = ParticipantInput(**raw)
            else:
                raise ValueError(
                    "Cada participante debe ser un string o un objeto {name, email}"
                )
            key = parsed.name.casefold()
            if key in seen_names:
                raise ValueError(f"Nombre duplicado: {parsed.name}")
            seen_names.add(key)
            if parsed.email:
                if parsed.email in seen_emails:
                    raise ValueError(f"Email duplicado: {parsed.email}")
                seen_emails.add(parsed.email)
            cleaned.append(parsed.model_dump())
        return cleaned


class Assignment(BaseModel):
    participant: str
    team: str
    ovr: int
    bombo: int
    pick_order: int


class GroupMember(BaseModel):
    participant: str
    team: str
    ovr: int
    bombo: int


class GroupOut(BaseModel):
    nombre: str
    integrantes: List[GroupMember]


class SorteoResponse(BaseModel):
    sorteo_id: str
    timestamp: str
    mode: Mode
    seed: Optional[int]
    participants: List[str]
    pool: List[TeamOut]
    bombos: List[BombosPreview]
    assignments: List[Assignment]
    groups: Optional[List[GroupOut]] = None
    hash: str
    warnings: List[str] = []


class VerifyResponse(BaseModel):
    sorteo_id: str
    verified: bool
    stored_hash: str
    computed_hash: str


class SorteoListItem(BaseModel):
    id: str
    timestamp: str
    mode: Mode
    seed: Optional[int]
    num_participants: int
    hash: str


class SorteoListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: List[SorteoListItem]


# ──────────────────────────────────────────────────────────────
# Torneos
# ──────────────────────────────────────────────────────────────
TournamentFormat = Literal["groups_knockout", "league", "knockout"]
TournamentStatus = Literal["draft", "groups", "knockout", "finished"]
MatchStage = Literal[
    "group", "league", "round_of_16", "quarter", "semi", "final", "third_place"
]
MatchStatus = Literal["scheduled", "played"]


class TournamentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    sorteo_id: Optional[str] = None
    format: TournamentFormat = "groups_knockout"
    num_groups: int = Field(default=4, ge=0, le=8)
    qualify_per_group: int = Field(default=2, ge=0, le=8)
    points_win: int = 3
    points_draw: int = 1
    points_loss: int = 0
    double_round: bool = False


class TournamentUpdate(BaseModel):
    name: Optional[str] = None
    num_groups: Optional[int] = None
    qualify_per_group: Optional[int] = None
    points_win: Optional[int] = None
    points_draw: Optional[int] = None
    points_loss: Optional[int] = None
    double_round: Optional[bool] = None


class TournamentOut(BaseModel):
    id: str
    name: str
    sorteo_id: Optional[str]
    format: TournamentFormat
    status: TournamentStatus
    num_groups: int
    qualify_per_group: int
    points_win: int
    points_draw: int
    points_loss: int
    double_round: bool
    created_at: str


class PlayerOut(BaseModel):
    id: int
    tournament_id: str
    display_name: str
    team_name: str
    team_type: Literal["club", "nation"]
    team_ovr: int
    team_att: int
    team_mid: int
    team_def: int
    bombo: int
    pick_order: int
    group_label: Optional[str]
    photo_filename: Optional[str]
    email: Optional[str] = None


class PlayerUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    group_label: Optional[str] = None
    email: Optional[str] = Field(default=None, max_length=120)

    @field_validator("email")
    @classmethod
    def _validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Email inválido")
        if len(v) > 120:
            raise ValueError("Email demasiado largo")
        return v.lower()


class TradeProposeRequest(BaseModel):
    proposer_id: int
    receiver_id: int
    proposer_email: str = Field(min_length=3, max_length=120)
    message: Optional[str] = Field(default=None, max_length=200)


class PlayerSummary(BaseModel):
    id: int
    display_name: str
    team_name: str
    team_type: Literal["club", "nation"]
    team_ovr: int
    bombo: int
    photo_filename: Optional[str]
    email_hint: Optional[str] = None


class TradeDelivery(BaseModel):
    sent: bool
    backend: str
    detail: str
    email: Optional[str] = None
    link: Optional[str] = None


class TradeOut(BaseModel):
    id: str
    tournament_id: str
    status: Literal[
        "pending", "confirmed", "awaiting_admin", "executed", "cancelled", "expired"
    ]
    message: Optional[str]
    created_at: str
    expires_at: str
    executed_at: Optional[str]
    cancelled_at: Optional[str]
    cancelled_by: Optional[str]
    proposer_confirmed_at: Optional[str]
    receiver_confirmed_at: Optional[str]
    proposer: PlayerSummary
    receiver: PlayerSummary
    delivery: Optional[dict] = None
    role: Optional[Literal["proposer", "receiver"]] = None
    proposer_token: Optional[str] = None
    receiver_token: Optional[str] = None


class MatchOut(BaseModel):
    id: int
    tournament_id: str
    stage: MatchStage
    round_number: int
    group_label: Optional[str]
    home_player_id: Optional[int]
    away_player_id: Optional[int]
    home_score: Optional[int]
    away_score: Optional[int]
    status: MatchStatus
    played_at: Optional[str]
    slot_home: Optional[str]
    slot_away: Optional[str]
    bracket_position: Optional[int]


class MatchResultIn(BaseModel):
    home_score: int = Field(ge=0, le=99)
    away_score: int = Field(ge=0, le=99)


class StandingRow(BaseModel):
    player_id: int
    display_name: str
    team_name: str
    team_ovr: int
    photo_filename: Optional[str]
    group_label: Optional[str]
    group_position: int
    pj: int
    pg: int
    pe: int
    pp: int
    gf: int
    gc: int
    dif: int
    pts: int


class TournamentDetail(BaseModel):
    tournament: TournamentOut
    players: List[PlayerOut]
    matches: List[MatchOut]
    standings: List[StandingRow]


class AdminLoginRequest(BaseModel):
    password: str


class AdminLoginResponse(BaseModel):
    token: str
    configured: bool


class RegistrationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    email: str = Field(min_length=3, max_length=120)
    notes: Optional[str] = Field(default=None, max_length=200)

    @field_validator("email")
    @classmethod
    def _clean_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Email inválido")
        return v

    @field_validator("name")
    @classmethod
    def _clean_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Nombre vacío")
        return v


class RegistrationOut(BaseModel):
    id: int
    name: str
    email: str
    created_at: str
    status: Literal["pending", "used", "removed"]
    used_in_sorteo_id: Optional[str] = None
    notes: Optional[str] = None


class RegistrationCountOut(BaseModel):
    pending: int
