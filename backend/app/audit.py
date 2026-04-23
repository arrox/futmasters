"""
Hash canónico SHA-256 para auditoría de sorteos.

El payload canónico se serializa con ``json.dumps(..., sort_keys=True,
ensure_ascii=False)`` para que cualquier modificación a los datos produzca
un hash distinto.
"""
from __future__ import annotations

import hashlib
import json
from typing import List, Optional


def build_canonical_payload(
    timestamp: str,
    mode: str,
    seed: Optional[int],
    participants: List[str],
    pool_used: List[str],
    bombos: List[dict],
    assignments: List[dict],
    groups: Optional[List[dict]],
) -> dict:
    """
    Normaliza los datos para el hashing. Mantiene solo los campos esenciales.
    """
    bombos_canon = [
        {
            "numero": b["numero"],
            "equipos": [e["name"] if isinstance(e, dict) else e for e in b["equipos"]],
        }
        for b in bombos
    ]

    assignments_canon = [
        {
            "participant": a["participant"],
            "team": a["team"],
            "ovr": a["ovr"],
            "bombo": a["bombo"],
            "pick_order": a["pick_order"],
        }
        for a in assignments
    ]

    groups_canon: Optional[List[dict]] = None
    if groups is not None:
        groups_canon = [
            {
                "nombre": g["nombre"],
                "integrantes": [
                    {
                        "participant": i["participant"],
                        "team": i["team"],
                        "ovr": i["ovr"],
                        "bombo": i["bombo"],
                    }
                    for i in g["integrantes"]
                ],
            }
            for g in groups
        ]

    return {
        "timestamp": timestamp,
        "mode": mode,
        "seed": seed,
        "participants": participants,
        "pool_used": pool_used,
        "bombos": bombos_canon,
        "assignments": assignments_canon,
        "groups": groups_canon,
    }


def compute_hash(canonical: dict) -> str:
    """Calcula el SHA-256 hex sobre el payload canónico serializado."""
    raw = json.dumps(canonical, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def verify_hash(canonical: dict, expected_hash: str) -> bool:
    """Comparación en tiempo constante para evitar side-channels."""
    import hmac

    return hmac.compare_digest(compute_hash(canonical), expected_hash)
