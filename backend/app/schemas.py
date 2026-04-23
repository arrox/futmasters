"""Schemas Pydantic v2 para request/response de la API."""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


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


class SorteoRequest(BaseModel):
    participants: List[str] = Field(min_length=2, max_length=20)
    mode: Mode
    seed: Optional[int] = None

    @field_validator("participants")
    @classmethod
    def _validate_participants(cls, v: List[str]) -> List[str]:
        cleaned: List[str] = []
        seen = set()
        for raw in v:
            if not isinstance(raw, str):
                raise ValueError("Nombres deben ser strings")
            name = raw.strip()
            if not name:
                raise ValueError("Nombres no pueden ser vacíos")
            if len(name) > 50:
                raise ValueError(f"Nombre '{name[:20]}...' excede 50 caracteres")
            key = name.casefold()
            if key in seen:
                raise ValueError(f"Nombre duplicado (case-insensitive): {name}")
            seen.add(key)
            cleaned.append(name)
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
