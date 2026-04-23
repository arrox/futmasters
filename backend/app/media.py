"""
Manejo de fotos de jugador: guardado en disco + resize con Pillow.

Las fotos se guardan en ``MEDIA_DIR/players/{uuid}.{ext}`` y se exponen vía
``GET /media/players/{filename}`` (sirve estáticos).
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import BinaryIO, Tuple

from PIL import Image, ImageOps


MEDIA_DIR_ENV = "FC26_MEDIA_DIR"
DEFAULT_MEDIA_DIR = Path(__file__).resolve().parent.parent / "media"

MAX_IMAGE_BYTES = 6 * 1024 * 1024  # 6 MB
ACCEPTED_MIME = {"image/jpeg", "image/png", "image/webp"}
TARGET_SIZE = (480, 480)  # cuadrado para cards FUT


def media_dir() -> Path:
    override = os.environ.get(MEDIA_DIR_ENV)
    base = Path(override) if override else DEFAULT_MEDIA_DIR
    (base / "players").mkdir(parents=True, exist_ok=True)
    return base


def save_player_photo(
    source: BinaryIO, original_filename: str, mime_type: str | None
) -> str:
    """
    Guarda la foto recortando a cuadrado ``TARGET_SIZE``. Devuelve filename relativo
    (ej. ``players/abc123.jpg``).
    """
    if mime_type and mime_type.lower() not in ACCEPTED_MIME:
        raise ValueError(
            f"Formato no soportado ({mime_type}). Usá JPEG, PNG o WebP."
        )

    data = source.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise ValueError(f"Imagen demasiado grande (max {MAX_IMAGE_BYTES // 1024 // 1024} MB)")

    from io import BytesIO

    try:
        img = Image.open(BytesIO(data))
        img.load()
    except Exception as exc:
        raise ValueError("No se pudo leer la imagen") from exc

    # Normalizar orientación EXIF y convertir a RGB (evita problemas con paleta).
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")

    # Fit a cuadrado recortando el centro.
    img = ImageOps.fit(img, TARGET_SIZE, method=Image.Resampling.LANCZOS)

    # Guardar como JPEG para tamaño consistente. Transparencia se pierde (ok
    # para fotos de jugador).
    if img.mode == "RGBA":
        bg = Image.new("RGB", img.size, (20, 22, 36))
        bg.paste(img, mask=img.split()[-1])
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")

    filename = f"players/{uuid.uuid4().hex}.jpg"
    out_path = media_dir() / filename
    img.save(out_path, format="JPEG", quality=88, optimize=True)

    return filename


def delete_player_photo(filename: str) -> None:
    if not filename:
        return
    # Prevenir path traversal
    clean = os.path.basename(filename.replace("..", ""))
    path = media_dir() / "players" / clean
    if path.is_file():
        try:
            path.unlink()
        except OSError:
            pass
