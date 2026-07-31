"""Segundo pase de reconocimiento para texto orientado."""

from typing import Any

from PIL import Image

from .ocr import get_recognizer
from .schemas import OcrTier

# PaddleOCR endereza el recorte solo si alto/ancho >= 1.5 (crop_image_regions.py), así
# que las palabras verticales por debajo de ese umbral llegan al reconocedor acostadas.
PADDLE_ROTATE_RATIO = 1.5
VERTICAL_MIN_RATIO = 1.2
# Ventaja de confianza exigida para reemplazar el texto original por el del recorte rotado.
RESCUE_MARGIN = 0.05
# Por debajo de esto el recorte es ilegible y solo agrega ruido y latencia.
MIN_CROP_SIDE = 10
RESCUE_BATCH_SIZE = 16
# Área (px²) a partir de la cual vale la pena barrer diagonales aunque la conf sea alta.
LARGE_AREA = 8000
# Barrido discreto para diagonales (AABB no aporta ángulo).
DIAGONAL_ANGLES = (-60.0, -45.0, -30.0, 30.0, 45.0, 60.0)


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


def _rescue_candidate_angles(
    ratio: float, orig_conf: float, area: float, textline_angle: int,
) -> tuple[float, list[float]]:
    """Devuelve (orientation_seed, ángulos a probar con TextRecognition)."""
    seed = 0.0
    angles: list[float] = []
    if ratio >= PADDLE_ROTATE_RATIO:
        # Paddle ya rotó el recorte; el clasificador solo aporta 0/180.
        flipped = textline_angle == 180
        seed = -90.0 if flipped else 90.0
        angles.append(-seed)
    elif ratio >= VERTICAL_MIN_RATIO:
        angles.extend((90.0, -90.0))
    if orig_conf < 0.95 or area >= LARGE_AREA:
        angles.extend(DIAGONAL_ANGLES)
    if orig_conf < 0.9:
        angles.append(180.0)
    seen: set[float] = set()
    unique: list[float] = []
    for ang in angles:
        key = round(ang, 1)
        if key not in seen:
            seen.add(key)
            unique.append(float(ang))
    return seed, unique


def _rescue_oriented_lines(
    path: str,
    lines: list[tuple[list, tuple[str, float]]],
    textline_angles: list[int],
    tier: OcrTier,
) -> tuple[list[tuple[list, tuple[str, float]]], list[float]]:
    """Endereza recortes (verticales y diagonales) y elige la lectura de mayor confianza."""
    # Import tardío para mantener explícita la dirección de dependencias.
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
        seed, attempts = _rescue_candidate_angles(ratio, float(orig_conf), area, textline)
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
        if score > float(orig_conf) + RESCUE_MARGIN:
            rescued[i] = (box, (text, score))
            orientations[i] = float(angle)
    return rescued, orientations
