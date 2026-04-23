"""
Generación de imágenes compartibles (highlights) de partidos jugados.

Produce un PNG 1200×630 (tamaño óptimo para preview de WhatsApp / OG image)
con fondo estadio + 2 mini-cards FUT + marcador grande al centro.
"""
from __future__ import annotations

import hashlib
import os
from io import BytesIO
from typing import Optional

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from . import db


WIDTH = 1200
HEIGHT = 630

# Paleta base — mismo lenguaje visual que la UI FUT.
COLOR_BG_TOP = (11, 17, 26)
COLOR_BG_BOT = (5, 7, 12)
COLOR_GOLD = (240, 196, 96)
COLOR_GOLD_DARK = (138, 90, 26)
COLOR_INK = (244, 239, 225)
COLOR_MUTED = (169, 163, 149)
COLOR_GREEN = (0, 255, 135)
COLOR_RED = (255, 59, 92)


# ──────────────────────────────────────────────────────────────
# Fonts
# ──────────────────────────────────────────────────────────────
_FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
]
_FONT_REGULAR_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/TTF/DejaVuSans.ttf",
]


def _font(size: int, bold: bool = True) -> ImageFont.ImageFont:
    cands = _FONT_CANDIDATES if bold else _FONT_REGULAR_CANDIDATES
    for path in cands:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:  # noqa: BLE001
                continue
    return ImageFont.load_default()


# ──────────────────────────────────────────────────────────────
# Fondo estadio
# ──────────────────────────────────────────────────────────────
def _stadium_bg() -> Image.Image:
    img = Image.new("RGB", (WIDTH, HEIGHT), COLOR_BG_BOT)
    px = img.load()
    for y in range(HEIGHT):
        t = y / (HEIGHT - 1)
        r = int(COLOR_BG_TOP[0] * (1 - t) + COLOR_BG_BOT[0] * t)
        g = int(COLOR_BG_TOP[1] * (1 - t) + COLOR_BG_BOT[1] * t)
        b = int(COLOR_BG_TOP[2] * (1 - t) + COLOR_BG_BOT[2] * t)
        for x in range(WIDTH):
            px[x, y] = (r, g, b)

    # Bokeh spots
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    spots = [
        (140, 140, 220, (240, 196, 96, 55)),
        (WIDTH - 180, 130, 180, (110, 197, 255, 45)),
        (340, HEIGHT - 100, 200, (0, 255, 135, 35)),
        (WIDTH - 240, HEIGHT - 160, 240, (255, 255, 255, 25)),
    ]
    for cx, cy, rad, color in spots:
        od.ellipse(
            [cx - rad, cy - rad, cx + rad, cy + rad], fill=color
        )
    overlay = overlay.filter(ImageFilter.GaussianBlur(80))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")

    # Pitch lines verticales
    draw = ImageDraw.Draw(img)
    for x in range(0, WIDTH, 120):
        draw.line([(x, 0), (x, HEIGHT)], fill=(240, 196, 96, 30), width=1)
    return img


# ──────────────────────────────────────────────────────────────
# Mini card (tier por OVR)
# ──────────────────────────────────────────────────────────────
def _pick_tier_colors(ovr: int) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
    if ovr >= 87:
        # icon: antique gold → black
        return (232, 197, 106), (10, 10, 12)
    if ovr >= 84:
        # gold metal
        return (255, 241, 193), (138, 90, 26)
    if ovr >= 82:
        # silver
        return (242, 244, 247), (126, 134, 145)
    # bronze
    return (232, 160, 107), (122, 66, 32)


def _draw_mini_card(
    canvas: Image.Image,
    x: int,
    y: int,
    w: int,
    h: int,
    player_name: str,
    team_name: str,
    ovr: int,
    att: int,
    mid: int,
    defe: int,
    photo_path: Optional[str] = None,
) -> None:
    top_col, bot_col = _pick_tier_colors(ovr)
    # Background layer
    bg = Image.new("RGB", (w, h), bot_col)
    bpx = bg.load()
    for yy in range(h):
        t = yy / (h - 1)
        r = int(top_col[0] * (1 - t) + bot_col[0] * t)
        g = int(top_col[1] * (1 - t) + bot_col[1] * t)
        b = int(top_col[2] * (1 - t) + bot_col[2] * t)
        for xx in range(w):
            bpx[xx, yy] = (r, g, b)

    # Corner cut via mask
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    cut = 18
    md.polygon(
        [
            (cut, 0), (w - cut, 0),
            (w, cut), (w, h - cut),
            (w - cut, h), (cut, h),
            (0, h - cut), (0, cut),
        ],
        fill=255,
    )

    card = Image.new("RGB", (w, h), bot_col)
    card.paste(bg, (0, 0))
    canvas.paste(card, (x, y), mask)

    # Shine sweep
    shine = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shine)
    # diagonal
    for i in range(-h, w + h, 4):
        alpha = max(0, 30 - abs((i - w // 3)) // 10)
        if alpha > 0:
            sd.line([(i, 0), (i + h, h)], fill=(255, 255, 255, alpha), width=3)
    canvas.paste(shine, (x, y), mask)

    draw = ImageDraw.Draw(canvas)

    # Text color: dark on light backgrounds
    text_col = (58, 42, 10) if sum(top_col) > 500 else (232, 197, 106)

    # OVR big
    ovr_font = _font(92)
    draw.text((x + 22, y + 18), str(ovr), fill=text_col, font=ovr_font)

    # POS
    pos = _position_for(att, mid, defe)
    pos_font = _font(28)
    draw.text((x + 26, y + 112), pos, fill=text_col, font=pos_font)

    # Photo on right
    crest_size = 120
    cx, cy = x + w - crest_size - 24, y + 26
    photo_loaded = False
    if photo_path and os.path.exists(photo_path):
        try:
            ph = Image.open(photo_path).convert("RGB").resize(
                (crest_size, crest_size), Image.Resampling.LANCZOS
            )
            # Round mask
            ph_mask = Image.new("L", (crest_size, crest_size), 0)
            ImageDraw.Draw(ph_mask).ellipse(
                [0, 0, crest_size, crest_size], fill=255
            )
            canvas.paste(ph, (cx, cy), ph_mask)
            # Border
            draw.ellipse(
                [cx, cy, cx + crest_size, cy + crest_size],
                outline=text_col, width=3,
            )
            photo_loaded = True
        except Exception:  # noqa: BLE001
            pass
    if not photo_loaded:
        draw.ellipse(
            [cx, cy, cx + crest_size, cy + crest_size],
            outline=text_col, width=3,
        )
        ini_font = _font(46)
        initials = _initials(player_name)
        bbox = draw.textbbox((0, 0), initials, font=ini_font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text(
            (cx + (crest_size - tw) // 2 - bbox[0],
             cy + (crest_size - th) // 2 - bbox[1]),
            initials, fill=text_col, font=ini_font,
        )

    # Divider
    mid_y = y + int(h * 0.58)
    draw.line(
        [(x + 24, mid_y), (x + w - 24, mid_y)],
        fill=text_col, width=1,
    )

    # Name
    name_font = _font(36)
    name = _truncate(player_name, 14)
    bbox = draw.textbbox((0, 0), name, font=name_font)
    tw = bbox[2] - bbox[0]
    draw.text(
        (x + (w - tw) // 2 - bbox[0], mid_y + 16),
        name, fill=text_col, font=name_font,
    )

    # Team
    team_font = _font(20, bold=False)
    team = _truncate(team_name, 22)
    bbox = draw.textbbox((0, 0), team, font=team_font)
    tw = bbox[2] - bbox[0]
    draw.text(
        (x + (w - tw) // 2 - bbox[0], mid_y + 60),
        team, fill=text_col, font=team_font,
    )

    # Stats
    stat_font = _font(28)
    lbl_font = _font(16, bold=False)
    cols = 3
    col_w = (w - 40) // cols
    stats = [("ATA", att), ("MED", mid), ("DEF", defe)]
    for i, (lbl, val) in enumerate(stats):
        cx2 = x + 20 + col_w * i
        # value
        vs = str(val)
        bbox = draw.textbbox((0, 0), vs, font=stat_font)
        tw = bbox[2] - bbox[0]
        draw.text(
            (cx2 + (col_w - tw) // 2 - bbox[0], y + h - 70),
            vs, fill=text_col, font=stat_font,
        )
        # label
        bbox = draw.textbbox((0, 0), lbl, font=lbl_font)
        tw = bbox[2] - bbox[0]
        draw.text(
            (cx2 + (col_w - tw) // 2 - bbox[0], y + h - 32),
            lbl, fill=text_col, font=lbl_font,
        )


def _position_for(att: int, mid: int, defe: int) -> str:
    if att >= mid and att >= defe:
        return "DEL"
    if defe >= mid:
        return "DEF"
    return "MED"


def _initials(name: str) -> str:
    words = [w for w in name.strip().split() if w]
    if not words:
        return "??"
    if len(words) == 1:
        return words[0][:2].upper()
    return (words[0][0] + words[-1][0]).upper()


def _truncate(s: str, maxlen: int) -> str:
    return s if len(s) <= maxlen else s[: maxlen - 1] + "…"


# ──────────────────────────────────────────────────────────────
# Score central + chrome
# ──────────────────────────────────────────────────────────────
def _draw_score(
    canvas: Image.Image,
    home_score: int,
    away_score: int,
    center_x: int = WIDTH // 2,
    center_y: int = HEIGHT // 2,
) -> None:
    draw = ImageDraw.Draw(canvas)
    score = f"{home_score} — {away_score}"
    font = _font(130)
    bbox = draw.textbbox((0, 0), score, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    # Shadow
    draw.text(
        (center_x - tw // 2 - bbox[0] + 4,
         center_y - th // 2 - bbox[1] + 6),
        score, fill=(0, 0, 0, 180), font=font,
    )
    # Gold text
    draw.text(
        (center_x - tw // 2 - bbox[0], center_y - th // 2 - bbox[1]),
        score, fill=COLOR_GOLD, font=font,
    )


def _draw_header(canvas: Image.Image, title: str, subtitle: str = "") -> None:
    draw = ImageDraw.Draw(canvas)
    eyebrow_font = _font(18, bold=False)
    draw.text(
        (40, 30),
        "FUTMASTERS · FC 26",
        fill=COLOR_MUTED,
        font=eyebrow_font,
    )
    title_font = _font(38)
    draw.text((40, 54), title, fill=COLOR_INK, font=title_font)
    if subtitle:
        sub_font = _font(18, bold=False)
        draw.text((40, 100), subtitle, fill=COLOR_GOLD, font=sub_font)
    # Gold bar
    draw.rectangle([40, 128, 160, 131], fill=COLOR_GOLD)


def _draw_footer(canvas: Image.Image, url: str) -> None:
    draw = ImageDraw.Draw(canvas)
    font = _font(18, bold=False)
    bbox = draw.textbbox((0, 0), url, font=font)
    tw = bbox[2] - bbox[0]
    draw.text(
        (WIDTH - tw - 40, HEIGHT - 42),
        url, fill=COLOR_MUTED, font=font,
    )


# ──────────────────────────────────────────────────────────────
# Entrada pública
# ──────────────────────────────────────────────────────────────
def render_match_highlight(
    match_id: int, media_dir, public_url: str = ""
) -> bytes:
    """Devuelve los bytes PNG del highlight del partido."""
    with db.get_conn() as conn:
        m = conn.execute(
            "SELECT * FROM matches WHERE id = ?", (match_id,)
        ).fetchone()
        if not m:
            raise ValueError("Partido no encontrado")
        if m["status"] != "played":
            raise ValueError("Partido aún no jugado")
        home = conn.execute(
            "SELECT * FROM players WHERE id = ?", (m["home_player_id"],)
        ).fetchone()
        away = conn.execute(
            "SELECT * FROM players WHERE id = ?", (m["away_player_id"],)
        ).fetchone()
        tourn = conn.execute(
            "SELECT * FROM tournaments WHERE id = ?", (m["tournament_id"],)
        ).fetchone()
    if not home or not away or not tourn:
        raise ValueError("Datos del partido incompletos")

    canvas = _stadium_bg().convert("RGB")

    stage_label = _stage_label(m["stage"], m["round_number"])
    _draw_header(canvas, tourn["name"], stage_label)

    # Dos cards laterales
    card_w, card_h = 360, 420
    margin_x = 40
    top_y = 160
    # Home (left)
    home_photo = None
    if home["photo_filename"]:
        from pathlib import Path
        candidate = Path(media_dir) / home["photo_filename"]
        if candidate.is_file():
            home_photo = str(candidate)
    _draw_mini_card(
        canvas,
        x=margin_x, y=top_y, w=card_w, h=card_h,
        player_name=home["display_name"],
        team_name=home["team_name"],
        ovr=home["team_ovr"],
        att=home["team_att"],
        mid=home["team_mid"],
        defe=home["team_def"],
        photo_path=home_photo,
    )
    # Away (right)
    away_photo = None
    if away["photo_filename"]:
        from pathlib import Path
        candidate = Path(media_dir) / away["photo_filename"]
        if candidate.is_file():
            away_photo = str(candidate)
    _draw_mini_card(
        canvas,
        x=WIDTH - margin_x - card_w, y=top_y, w=card_w, h=card_h,
        player_name=away["display_name"],
        team_name=away["team_name"],
        ovr=away["team_ovr"],
        att=away["team_att"],
        mid=away["team_mid"],
        defe=away["team_def"],
        photo_path=away_photo,
    )

    # Score central
    _draw_score(canvas, m["home_score"], m["away_score"])

    # Footer URL
    if public_url:
        _draw_footer(canvas, public_url)

    out = BytesIO()
    canvas.save(out, format="PNG", optimize=True)
    return out.getvalue()


def _stage_label(stage: str, round_number: int) -> str:
    if stage == "group":
        return f"Fase de grupos · Fecha {round_number}"
    if stage == "league":
        return f"Liga · Fecha {round_number}"
    return (
        {
            "round_of_16": "Octavos de final",
            "quarter": "Cuartos de final",
            "semi": "Semifinal",
            "final": "Final",
            "third_place": "3° y 4° puesto",
        }
    ).get(stage, stage)
