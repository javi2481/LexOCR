"""Render de PNG anotado a partir del OCRResult ya guardado (sin re-inferir)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

# Misma paleta que el frontend (resultLayout.ts), en RGB.
PALETTE: list[tuple[int, int, int]] = [
    (99, 102, 241),
    (239, 68, 68),
    (34, 197, 94),
    (245, 158, 11),
    (168, 85, 247),
    (6, 182, 212),
    (249, 115, 22),
    (236, 72, 153),
]


def _font(size: int = 14) -> ImageFont.ImageFont | ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype("arial.ttf", size=size)
    except Exception:
        try:
            return ImageFont.truetype("DejaVuSans.ttf", size=size)
        except Exception:
            return ImageFont.load_default()


def _poly_points(poly: Any) -> list[tuple[float, float]]:
    pts: list[tuple[float, float]] = []
    if not isinstance(poly, (list, tuple)):
        return pts
    for p in poly:
        if isinstance(p, (list, tuple)) and len(p) >= 2:
            pts.append((float(p[0]), float(p[1])))
    return pts


def render_annotated_from_result(
    image_path: Path,
    result: dict[str, Any],
    out_path: Path,
) -> Path:
    """Dibuja regiones del resultado guardado sobre la imagen y guarda PNG."""
    regions = result.get("regions") or []
    with Image.open(image_path) as src:
        canvas = src.convert("RGBA")

    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    label_draw = ImageDraw.Draw(canvas)
    font = _font(max(12, min(canvas.size) // 60))

    for i, region in enumerate(regions):
        if not isinstance(region, dict):
            continue
        color = PALETTE[i % len(PALETTE)]
        fill = (*color, 36)
        outline = (*color, 230)
        pts = _poly_points(region.get("poly"))
        if len(pts) >= 3:
            draw.polygon(pts, fill=fill)
            draw.line(pts + [pts[0]], fill=outline, width=2)
            anchor_x = min(p[0] for p in pts)
            anchor_y = min(p[1] for p in pts)
        else:
            bbox = region.get("bbox") or {}
            x = float(bbox.get("x", 0))
            y = float(bbox.get("y", 0))
            w = float(bbox.get("width", 0))
            h = float(bbox.get("height", 0))
            box = [x, y, x + w, y + h]
            draw.rectangle(box, fill=fill, outline=outline, width=2)
            anchor_x, anchor_y = x, y

        rid = region.get("id", i)
        conf = float(region.get("confidence", 0.0))
        label = f"#{rid} · {conf * 100:.0f}%"
        ty = max(0.0, anchor_y - 16)
        label_draw.text((anchor_x, ty), label, fill=color + (255,), font=font)

    composed = Image.alpha_composite(canvas, overlay).convert("RGB")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    composed.save(out_path, format="PNG")
    return out_path
