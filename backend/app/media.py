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

import hashlib
import random

from PIL import Image, ImageDraw, ImageFont, ImageOps


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


# ──────────────────────────────────────────────────────────────
# Avatar auto-generado cuando el admin no sube foto.
# Se genera un JPEG 480×480 con gradiente derivado del nombre
# + iniciales en el centro. Se guarda en el mismo directorio que
# las fotos reales para que el resto del flujo no cambie.
# ──────────────────────────────────────────────────────────────
_PALETTES = [
    ("#f0c460", "#8a5a1a"),   # gold metal
    ("#6ec5ff", "#0e2a6b"),   # TOTW
    ("#ff8a4b", "#7a4220"),   # bronze
    ("#d8dde3", "#6b6d7a"),   # silver
    ("#e8c56a", "#0a0a0c"),   # icon
    ("#00ff87", "#00663a"),   # FUT green
    ("#ff6b9a", "#6b1e3e"),   # rose
    ("#a78bfa", "#3b1e7a"),   # purple
]


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore


def _initials(name: str) -> str:
    words = [w for w in name.strip().split() if w]
    if not words:
        return "??"
    if len(words) == 1:
        return words[0][:2].upper()
    return (words[0][0] + words[-1][0]).upper()


def _pick_palette(name: str) -> tuple[str, str]:
    """Palette determinista según hash del nombre."""
    h = hashlib.sha1(name.encode("utf-8")).digest()[0]
    return _PALETTES[h % len(_PALETTES)]


def _load_big_font(size: int) -> ImageFont.ImageFont:
    """Intenta cargar DejaVu Sans Bold; si no, default bitmap escalada."""
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:  # noqa: BLE001
                continue
    return ImageFont.load_default()


def generate_avatar_for(name: str) -> str:
    """
    Crea un avatar 480×480 con gradiente + iniciales. Devuelve filename relativo.
    """
    from io import BytesIO

    top_hex, bot_hex = _pick_palette(name)
    top = _hex_to_rgb(top_hex)
    bot = _hex_to_rgb(bot_hex)
    size = TARGET_SIZE[0]

    # Gradiente vertical (linear)
    img = Image.new("RGB", (size, size), bot)
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        r = int(top[0] * (1 - t) + bot[0] * t)
        g = int(top[1] * (1 - t) + bot[1] * t)
        b = int(top[2] * (1 - t) + bot[2] * t)
        for x in range(size):
            px[x, y] = (r, g, b)

    # Patrón diagonal sutil
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for i in range(-size, size, 24):
        od.line(
            [(i, 0), (i + size, size)],
            fill=(255, 255, 255, 12),
            width=3,
        )
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")

    # Iniciales grandes en el centro
    text = _initials(name)
    font = _load_big_font(260)
    d = ImageDraw.Draw(img)
    try:
        bbox = d.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        xoff, yoff = bbox[0], bbox[1]
    except AttributeError:
        tw, th = d.textsize(text, font=font)
        xoff = yoff = 0
    x = (size - tw) // 2 - xoff
    y = (size - th) // 2 - yoff
    # Sombra
    d.text((x + 3, y + 4), text, font=font, fill=(0, 0, 0, 160))
    d.text((x, y), text, font=font, fill=(255, 255, 255))

    filename = f"players/auto-{uuid.uuid4().hex}.jpg"
    out = media_dir() / filename
    img.save(out, format="JPEG", quality=86, optimize=True)
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
