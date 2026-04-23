"""
Auth admin simple por bearer token.

El secreto se configura con la env var ``ADMIN_PASSWORD``. El cliente envía
``Authorization: Bearer <password>``. Si no hay password configurado, se
permite acceso (modo desarrollo). En producción se espera que la variable
esté seteada.
"""
from __future__ import annotations

import hmac
import os

from fastapi import Depends, Header, HTTPException, status


ADMIN_PASSWORD_ENV = "ADMIN_PASSWORD"


def admin_password() -> str | None:
    return os.environ.get(ADMIN_PASSWORD_ENV) or None


def require_admin(authorization: str | None = Header(default=None)) -> None:
    """Dependencia FastAPI: valida el bearer token contra ``ADMIN_PASSWORD``."""
    pwd = admin_password()
    if not pwd:
        # Sin password configurado → acceso libre (dev). Logueable si se quiere.
        return
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere Authorization: Bearer <password>",
        )
    token = authorization[7:].strip()
    if not hmac.compare_digest(token, pwd):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Password admin inválido",
        )
