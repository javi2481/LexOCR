"""Normalización de resultados de PaddleOCR."""

from typing import Any

from .schemas import InferOptions, OCRResult, Region


def _page_to_dict(page: Any) -> dict[str, Any]:
    if isinstance(page, dict):
        return page.get("res", page) if "res" in page else page
    if hasattr(page, "json"):
        data = page.json
        if callable(data):
            data = data()
        if isinstance(data, dict) and "res" in data:
            return data["res"]
        if isinstance(data, dict):
            return data
    out: dict[str, Any] = {}
    for key in (
        "rec_texts", "rec_scores", "rec_polys", "dt_polys", "rec_boxes",
        "textline_orientation_angles",
    ):
        val = page.get(key) if hasattr(page, "get") else getattr(page, key, None)
        if val is not None:
            out[key] = val
    return out


def _normalize_poly(poly: Any) -> list[list[float]]:
    if poly is None:
        return []
    if hasattr(poly, "tolist"):
        poly = poly.tolist()
    points: list[list[float]] = []
    if isinstance(poly, (list, tuple)) and poly and not isinstance(poly[0], (list, tuple)):
        flat = list(poly)
        for i in range(0, len(flat) - 1, 2):
            points.append([round(float(flat[i]), 2), round(float(flat[i + 1]), 2)])
        return points
    for p in poly:
        if isinstance(p, (list, tuple)) and len(p) >= 2:
            points.append([round(float(p[0]), 2), round(float(p[1]), 2)])
    return points


def _parse_paddle_raw(
    raw: Any,
) -> tuple[list[tuple[list, tuple[str, float]]], list[int]]:
    """Normalize PaddleOCR output to [(polygon, (text, conf)), ...] + ángulos de línea.

    Prefer dt_polys as master list so every detection becomes a region,
    even when recognition is empty or missing. El ángulo (0 o 180) es el que el
    clasificador de orientación de línea aplicó a cada recorte.
    """
    lines: list[tuple[list, tuple[str, float]]] = []
    textline_angles: list[int] = []
    if not raw:
        return lines, textline_angles
    pages = raw if isinstance(raw, list) else [raw]
    for page in pages:
        if page is None:
            continue
        data = _page_to_dict(page)
        dt_polys = data.get("dt_polys")
        rec_polys = data.get("rec_polys")
        texts = list(data.get("rec_texts") or [])
        scores = list(data.get("rec_scores") or [])
        boxes = data.get("rec_boxes")
        angles = list(data.get("textline_orientation_angles") or [])
        if dt_polys is not None or rec_polys is not None or texts or scores:
            if hasattr(dt_polys, "tolist"):
                dt_polys = dt_polys.tolist()
            if hasattr(rec_polys, "tolist"):
                rec_polys = rec_polys.tolist()
            if dt_polys is not None:
                master = list(dt_polys)
            elif rec_polys is not None:
                master = list(rec_polys)
            else:
                master = []
            n = len(master) if master else len(texts)
            for i in range(n):
                if i < len(master):
                    box = master[i]
                    if hasattr(box, "tolist"):
                        box = box.tolist()
                elif boxes is not None and i < len(boxes):
                    b = boxes[i]
                    if hasattr(b, "tolist"):
                        b = b.tolist()
                    box = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]
                else:
                    box = [[0, 0], [0, 0], [0, 0], [0, 0]]
                text = str(texts[i]) if i < len(texts) else ""
                conf = float(scores[i]) if i < len(scores) else 0.0
                lines.append((box, (text, conf)))
                textline_angles.append(int(angles[i]) if i < len(angles) else 0)
            continue
        if isinstance(page, (list, tuple)):
            for line in page:
                if not line or not isinstance(line, (list, tuple)) or len(line) < 2:
                    continue
                bbox_raw, rec = line[0], line[1]
                if isinstance(rec, (list, tuple)) and len(rec) >= 2:
                    lines.append((bbox_raw, (str(rec[0]), float(rec[1]))))
                    textline_angles.append(0)
    return lines, textline_angles


def _polygon_to_bbox(poly: list) -> dict[str, float]:
    xs: list[float] = []
    ys: list[float] = []
    if hasattr(poly, "tolist"):
        poly = poly.tolist()
    for p in poly:
        if isinstance(p, (list, tuple)) and len(p) >= 2:
            xs.append(float(p[0]))
            ys.append(float(p[1]))
    if not xs and isinstance(poly, (list, tuple)) and poly and not isinstance(poly[0], (list, tuple)):
        flat = list(poly)
        for i in range(0, len(flat) - 1, 2):
            xs.append(float(flat[i]))
            ys.append(float(flat[i + 1]))
    if not xs:
        return {"x": 0, "y": 0, "width": 0, "height": 0}
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    return {
        "x": round(min_x, 2), "y": round(min_y, 2),
        "width": round(max_x - min_x, 2), "height": round(max_y - min_y, 2),
    }


def _build_result(
    image_id: str,
    item: dict[str, Any],
    lines: list[tuple[list, tuple[str, float]]],
    elapsed: float,
    width: int,
    height: int,
    options: InferOptions,
    orientations: list[float] | None = None,
) -> OCRResult:
    regions: list[Region] = []
    for i, (bbox_raw, (text, conf)) in enumerate(lines):
        poly = _normalize_poly(bbox_raw)
        ang = float(orientations[i]) if orientations and i < len(orientations) else 0.0
        regions.append(Region(
            id=i, text=text, confidence=round(float(conf), 3),
            bbox=_polygon_to_bbox(bbox_raw), poly=poly, orientation=round(ang, 1),
        ))
    confs = [r.confidence for r in regions]
    thr = options.conf_threshold
    return OCRResult(
        image_id=image_id, filename=item["filename"], status="completed",
        inference_time_ms=elapsed,
        confidence_avg=round(sum(confs) / len(confs), 3) if confs else 0.0,
        regions_count=len(regions),
        low_confidence_count=len([c for c in confs if c < thr]),
        regions=regions, width=width, height=height,
        ocr_mode="fast", ocr_tier="medium", conf_threshold=thr,
    )
