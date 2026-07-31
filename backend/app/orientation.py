"""Segundo pase de reconocimiento para texto orientado."""

from typing import Any

from PIL import Image

from .ocr import get_recognizer
from .schemas import OcrTier

# PaddleOCR endereza el recorte solo si alto/ancho >= 1.5 (crop_image_regions.py), así
# que las palabras verticales por debajo de ese umbral llegan al reconocedor acostadas.
PADDLE_ROTATE_RATIO = 1.5
VERTICAL_MIN_RATIO = 1.2
# Margen estándar (horizontales / verticales ~0/±90/180).
RESCUE_MARGIN = 0.05
# Margen más bajo para diagonales: el recognizer base ya falla con baja conf.
DIAGONAL_RESCUE_MARGIN = 0.02
MIN_CROP_SIDE = 10
RESCUE_BATCH_SIZE = 16
LARGE_AREA = 8000
# Fallback ciego solo si no hay ángulo estimado dentro del crop.
DIAGONAL_ANGLES = (-75.0, -60.0, -45.0, -30.0, -15.0, 15.0, 30.0, 45.0, 60.0, 75.0)
# Barrido fino alrededor de la semilla estimada (texto dentro del crop, no del AABB).
SWEEP_DELTAS = (-15.0, -7.5, 0.0, 7.5, 15.0)
# Umbral: horizontal / vertical vs diagonal.
_AXIS_EPS = 15.0


def _quad_crop(img: Any, quad: list[list[float]]) -> tuple[Any, float, float]:
    """Recorta el cuadrilátero y lo rectifica, igual que hace PaddleOCR internamente."""
    import cv2
    import numpy as np
    pts = np.float32(quad)
    width = int(max(np.linalg.norm(pts[0] - pts[1]), np.linalg.norm(pts[2] - pts[3])))
    height = int(max(np.linalg.norm(pts[0] - pts[3]), np.linalg.norm(pts[1] - pts[2])))
    if width < MIN_CROP_SIDE or height < MIN_CROP_SIDE:
        return None, 0.0, 0.0
    dst = np.float32([[0, 0], [width, 0], [width, height], [0, height]])
    crop = cv2.warpPerspective(
        img, cv2.getPerspectiveTransform(pts, dst), (width, height),
        borderMode=cv2.BORDER_REPLICATE, flags=cv2.INTER_CUBIC,
    )
    return crop, height / width, float(width * height)


def _rotate_crop(crop: Any, angle_deg: float) -> Any:
    """Rota el recorte en sentido antihorario (OpenCV). orientation de dibujo = este ángulo."""
    import cv2
    import numpy as np
    a = float(angle_deg) % 360.0
    if a > 180.0:
        a -= 360.0
    if abs(a) < 0.5:
        return crop
    if abs(a - 90.0) < 0.5:
        return np.rot90(crop, 1)
    if abs(a + 90.0) < 0.5:
        return np.rot90(crop, 3)
    if abs(abs(a) - 180.0) < 0.5:
        return np.rot90(crop, 2)
    h, w = crop.shape[:2]
    matrix = cv2.getRotationMatrix2D((w / 2.0, h / 2.0), a, 1.0)
    cos = abs(matrix[0, 0])
    sin = abs(matrix[0, 1])
    nw = int(h * sin + w * cos)
    nh = int(h * cos + w * sin)
    matrix[0, 2] += (nw - w) / 2.0
    matrix[1, 2] += (nh - h) / 2.0
    return cv2.warpAffine(
        crop, matrix, (nw, nh), borderMode=cv2.BORDER_REPLICATE,
        flags=cv2.INTER_CUBIC,
    )


def _normalize_text_angle(angle_deg: float) -> float:
    """Normaliza a (-90, 90] para orientación de línea de texto."""
    a = float(angle_deg) % 180.0
    if a > 90.0:
        a -= 180.0
    if a <= -90.0:
        a += 180.0
    return a


def _estimate_text_angle(crop: Any) -> float | None:
    """Ángulo del texto DENTRO del recorte (Otsu + minAreaRect sobre todos los contornos)."""
    import cv2
    import numpy as np
    if crop is None or getattr(crop, "size", 0) == 0:
        return None
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if len(crop.shape) == 3 else crop
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    _, binary = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    min_area = max(20.0, 0.01 * float(binary.shape[0] * binary.shape[1]))
    kept = [c for c in contours if float(cv2.contourArea(c)) >= min_area]
    if not kept:
        return None
    all_pts = np.vstack(kept)
    if len(all_pts) < 5:
        return None
    (_cx, _cy), (w, h), angle = cv2.minAreaRect(all_pts)
    if w < 1.0 or h < 1.0:
        return None
    # OpenCV: angle en [-90, 0); orientar según eje mayor del rectángulo.
    if w < h:
        text_angle = float(angle) - 90.0
    else:
        text_angle = float(angle)
    text_angle = _normalize_text_angle(text_angle)
    if abs(text_angle) < 1.0:
        return None
    return round(text_angle, 1)


def _dedupe_angles(angles: list[float]) -> list[float]:
    seen: set[float] = set()
    unique: list[float] = []
    for ang in angles:
        key = round(ang, 1)
        if key not in seen:
            seen.add(key)
            unique.append(float(ang))
    return unique


def _is_diagonal(angle_deg: float) -> bool:
    """True si el ángulo no es casi horizontal ni casi vertical."""
    a = abs(float(angle_deg)) % 180.0
    if a > 90.0:
        a = 180.0 - a
    return not (a < _AXIS_EPS or abs(a - 90.0) < _AXIS_EPS)


def _rescue_candidate_angles(
    ratio: float,
    orig_conf: float,
    area: float,
    textline_angle: int,
    estimated: float | None = None,
) -> tuple[float, list[float]]:
    """Devuelve (orientation_seed, ángulos a probar con TextRecognition)."""
    seed = 0.0
    angles: list[float] = []
    need_diagonal = orig_conf < 0.95 or area >= LARGE_AREA
    if estimated is not None and need_diagonal:
        # Barrido fino alrededor del ángulo del texto dentro del crop.
        angles.extend(estimated + d for d in SWEEP_DELTAS)
    elif need_diagonal:
        angles.extend(DIAGONAL_ANGLES)
    if ratio >= PADDLE_ROTATE_RATIO:
        flipped = textline_angle == 180
        seed = -90.0 if flipped else 90.0
        angles.append(-seed)
    elif ratio >= VERTICAL_MIN_RATIO:
        angles.extend((90.0, -90.0))
    if orig_conf < 0.9:
        angles.append(180.0)
    return seed, _dedupe_angles(angles)


def _rescue_oriented_lines(
    path: str,
    lines: list[tuple[list, tuple[str, float]]],
    textline_angles: list[int],
    tier: OcrTier,
) -> tuple[list[tuple[list, tuple[str, float]]], list[float]]:
    """Endereza recortes (verticales y diagonales) y elige la lectura de mayor confianza.

    Nota: parsing ya prefiere dt_polys/rec_polys (cuadriláteros). No usamos APIs
    2.x deprecadas (det_db_*, use_dilation); en 3.x son text_det_*.
    """
    from .parsing import _normalize_poly
    orientations = [0.0] * len(lines)
    if not lines:
        return lines, orientations
    import numpy as np
    with Image.open(path) as opened:
        img = np.array(opened.convert("RGB"))[:, :, ::-1]
    crops: list[Any] = []
    owners: list[tuple[int, float]] = []
    for i, (box, (text, orig_conf)) in enumerate(lines):
        if len(text.strip()) == 1:
            continue
        quad = _normalize_poly(box)
        if len(quad) != 4:
            continue
        crop, ratio, area = _quad_crop(img, quad)
        if crop is None:
            continue
        textline = int(textline_angles[i]) if i < len(textline_angles) else 0
        estimated = _estimate_text_angle(crop)
        seed, attempts = _rescue_candidate_angles(
            ratio, float(orig_conf), area, textline, estimated,
        )
        if seed != 0.0:
            orientations[i] = seed
        if not attempts:
            continue
        for angle in attempts:
            crops.append(_rotate_crop(crop, angle))
            owners.append((i, angle))
    if not crops:
        return lines, orientations
    predictions = get_recognizer(tier).predict(crops, batch_size=RESCUE_BATCH_SIZE)
    best: dict[int, tuple[str, float, float]] = {}
    for (i, angle), out in zip(owners, predictions):
        text = str(out.get("rec_text", "") or "")
        score = float(out.get("rec_score", 0.0) or 0.0)
        if text and score > best.get(i, ("", -1.0, 0.0))[1]:
            best[i] = (text, score, angle)
    rescued = list(lines)
    for i, (text, score, angle) in best.items():
        box, (_, orig_conf) = rescued[i]
        margin = DIAGONAL_RESCUE_MARGIN if _is_diagonal(angle) else RESCUE_MARGIN
        if score > float(orig_conf) + margin:
            rescued[i] = (box, (text, score))
            orientations[i] = float(angle)
    return rescued, orientations
