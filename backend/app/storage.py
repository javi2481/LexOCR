"""Almacenamiento temporal y normalización de imágenes."""

from io import BytesIO
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from PIL import Image

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
UPLOAD_DIR = _BACKEND_ROOT / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
ANNOTATED_DIR = UPLOAD_DIR / "annotated"
ANNOTATED_DIR.mkdir(exist_ok=True)

MAX_PAGES = 50

ALLOWED_MIME = {
    "image/png", "image/jpeg", "image/jpg", "image/bmp", "image/gif",
    "image/webp", "image/avif", "image/tiff", "image/tif", "image/x-tiff",
    "image/x-icon", "image/vnd.microsoft.icon", "image/x-portable-pixmap",
    "image/x-portable-anymap", "application/octet-stream", "application/pdf",
}
ALLOWED_EXT = {
    "png", "jpg", "jpeg", "jfif", "bmp", "gif", "webp", "avif",
    "tif", "tiff", "ico", "ppm", "pnm", "pdf",
}
# Imágenes de escena: una página → PNG.
IMAGE_KINDS = frozenset(
    {"png", "jpeg", "gif", "bmp", "webp", "avif", "ico", "ppm"}
)
# Documentos multipágina vía engine PP-OCRv6 documento.
DOCUMENT_KINDS = frozenset({"pdf", "tiff"})
MAGIC_PREFIXES = (
    (b"%PDF", "pdf"),
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"\xff\xd8\xff", "jpeg"),
    (b"GIF87a", "gif"),
    (b"GIF89a", "gif"),
    (b"BM", "bmp"),
    (b"II*\x00", "tiff"),
    (b"MM\x00*", "tiff"),
)

# image_id -> metadata
store: dict[str, dict[str, Any]] = {}


def _detect_format(data: bytes, filename: str, content_type: str) -> str:
    """Detecta formato por magic bytes, extensión o MIME."""
    for prefix, kind in MAGIC_PREFIXES:
        if data.startswith(prefix):
            return kind
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if len(data) >= 12 and data[4:8] == b"ftyp" and data[8:12] in (b"avif", b"avis"):
        return "avif"
    if data[:1] == b"P" and len(data) > 1 and data[1:2] in (b"3", b"6"):
        return "ppm"

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ALLOWED_EXT:
        if ext in ("jpg", "jpeg", "jfif"):
            return "jpeg"
        if ext in ("tif", "tiff"):
            return "tiff"
        if ext in ("ppm", "pnm"):
            return "ppm"
        if ext == "ico":
            return "ico"
        return ext

    mime = content_type.split(";")[0].strip().lower()
    mime_map = {
        "image/png": "png", "image/jpeg": "jpeg", "image/jpg": "jpeg",
        "image/gif": "gif", "image/bmp": "bmp", "image/webp": "webp",
        "image/avif": "avif", "image/tiff": "tiff", "image/tif": "tiff",
        "image/x-tiff": "tiff", "image/x-icon": "ico",
        "image/vnd.microsoft.icon": "ico", "image/x-portable-pixmap": "ppm",
        "application/pdf": "pdf",
    }
    if mime in mime_map:
        return mime_map[mime]
    raise HTTPException(400, "Formato no soportado")


def _ext_for_kind(kind: str) -> str:
    if kind == "jpeg":
        return "jpg"
    if kind == "tiff":
        return "tif"
    return kind


def _save_original(data: bytes, image_id: str, kind: str) -> Path:
    """Guarda el archivo original (PDF/TIFF) sin rasterizar a mano."""
    out = UPLOAD_DIR / f"{image_id}.{_ext_for_kind(kind)}"
    out.write_bytes(data)
    return out


def _normalize_to_png(data: bytes, kind: str, image_id: str) -> Path:
    """Convierte cualquier formato de imagen aceptado a PNG RGB para OCR y preview."""
    out = UPLOAD_DIR / f"{image_id}.png"
    try:
        if kind == "avif":
            try:
                import pillow_avif  # noqa: F401
            except ImportError:
                pass
        img = Image.open(BytesIO(data))
        img.load()
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        elif img.mode == "L":
            img = img.convert("RGB")
        img.save(out, format="PNG")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, f"No se pudo leer el archivo: {exc}") from exc
    return out


def _tiff_frame_count(path: Path) -> int:
    try:
        with Image.open(path) as img:
            n = getattr(img, "n_frames", 1)
            return max(1, int(n))
    except Exception:
        return 1


def _tiff_frame_to_png(path: Path, frame_index: int, image_id: str) -> Path:
    """Extrae un frame TIFF a PNG (fallback si Paddle no pagina)."""
    out = UPLOAD_DIR / f"{image_id}.png"
    with Image.open(path) as img:
        img.seek(frame_index)
        img.load()
        frame = img.convert("RGB") if img.mode != "RGB" else img.copy()
        frame.save(out, format="PNG")
    return out


def _array_to_png(arr: Any, image_id: str) -> Path | None:
    """Guarda un ndarray / PIL Image como PNG de preview."""
    out = UPLOAD_DIR / f"{image_id}.png"
    try:
        import numpy as np
        if hasattr(arr, "tolist") and not isinstance(arr, Image.Image):
            arr = np.asarray(arr)
        if isinstance(arr, np.ndarray):
            if arr.ndim == 2:
                img = Image.fromarray(arr.astype("uint8"), mode="L").convert("RGB")
            elif arr.ndim == 3 and arr.shape[2] >= 3:
                img = Image.fromarray(arr[:, :, :3].astype("uint8"), mode="RGB")
            else:
                return None
            img.save(out, format="PNG")
            return out
        if isinstance(arr, Image.Image):
            arr.convert("RGB").save(out, format="PNG")
            return out
    except Exception:
        return None
    return None
