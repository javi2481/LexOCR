"""IDP OCR Studio — FastAPI + PaddleOCR (single file)."""

from __future__ import annotations

import os
import time
import uuid
from pathlib import Path
from typing import Any

# Cache de PaddleX dentro del proyecto (evita escribir en ~/.paddlex)
_ROOT = Path(__file__).resolve().parent
_PADDLEX = _ROOT / ".paddlex"
_PADDLEX.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("PADDLE_PDX_CACHE_HOME", str(_PADDLEX))
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from PIL import Image

UPLOAD_DIR = _ROOT / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_MIME = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/bmp",
    "image/gif",
    "image/webp",
    "image/avif",
    "image/tiff",
    "image/tif",
    "image/x-tiff",
    "image/x-icon",
    "image/vnd.microsoft.icon",
    "image/x-portable-pixmap",
    "image/x-portable-anymap",
    "application/pdf",
    "application/octet-stream",  # algunos browsers mandan esto; se valida por magic/ext
}

ALLOWED_EXT = {
    "png",
    "jpg",
    "jpeg",
    "jfif",
    "bmp",
    "gif",
    "webp",
    "avif",
    "tif",
    "tiff",
    "ico",
    "ppm",
    "pnm",
    "pdf",
}

MAGIC_PREFIXES = (
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"\xff\xd8\xff", "jpeg"),
    (b"GIF87a", "gif"),
    (b"GIF89a", "gif"),
    (b"BM", "bmp"),
    (b"%PDF", "pdf"),
    (b"II*\x00", "tiff"),
    (b"MM\x00*", "tiff"),
)

app = FastAPI(title="IDP OCR Studio")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# image_id -> metadata
store: dict[str, dict[str, Any]] = {}

ocr_engine = None


def get_ocr():
    """Lazy-init PaddleOCR PP-OCRv6 (unified multilingual, no lang)."""
    global ocr_engine
    if ocr_engine is not None:
        return ocr_engine
    from paddleocr import PaddleOCR

    kwargs = {
        "ocr_version": "PP-OCRv6",
        "use_doc_orientation_classify": False,
        "use_doc_unwarping": False,
        "use_textline_orientation": False,
        "enable_mkldnn": False,
    }
    try:
        ocr_engine = PaddleOCR(**kwargs)
    except TypeError:
        kwargs.pop("enable_mkldnn", None)
        try:
            ocr_engine = PaddleOCR(**kwargs)
        except TypeError:
            kwargs.pop("ocr_version", None)
            ocr_engine = PaddleOCR(**kwargs) if kwargs else PaddleOCR()
    return ocr_engine


class Region(BaseModel):
    id: int
    text: str
    confidence: float
    bbox: dict[str, float]


class OCRResult(BaseModel):
    image_id: str
    filename: str
    status: str
    inference_time_ms: float
    confidence_avg: float
    regions_count: int
    low_confidence_count: int
    regions: list[Region]
    width: int
    height: int


class BatchRequest(BaseModel):
    image_ids: list[str] = Field(default_factory=list)


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
    # OCRResult dict-like
    out: dict[str, Any] = {}
    for key in ("rec_texts", "rec_scores", "rec_polys", "dt_polys", "rec_boxes"):
        if hasattr(page, "get"):
            val = page.get(key)
        else:
            val = getattr(page, key, None)
        if val is not None:
            out[key] = val
    return out


def _run_paddle(path: str) -> list[tuple[list, tuple[str, float]]]:
    """Normalize PaddleOCR output to [(polygon, (text, conf)), ...]."""
    engine = get_ocr()
    lines: list[tuple[list, tuple[str, float]]] = []

    raw = None
    if hasattr(engine, "predict"):
        raw = engine.predict(path)
    else:
        try:
            raw = engine.ocr(path, cls=True)
        except TypeError:
            raw = engine.ocr(path)

    if not raw:
        return lines

    pages = raw if isinstance(raw, list) else [raw]
    for page in pages:
        if page is None:
            continue
        data = _page_to_dict(page)

        # PaddleOCR / PaddleX predict format
        if "rec_texts" in data or "rec_scores" in data:
            texts = list(data.get("rec_texts") or [])
            scores = list(data.get("rec_scores") or [])
            polys = data.get("rec_polys") or data.get("dt_polys") or []
            boxes = data.get("rec_boxes")
            for i, text in enumerate(texts):
                conf = float(scores[i]) if i < len(scores) else 0.0
                if i < len(polys):
                    box = polys[i]
                    if hasattr(box, "tolist"):
                        box = box.tolist()
                elif boxes is not None and i < len(boxes):
                    b = boxes[i]
                    if hasattr(b, "tolist"):
                        b = b.tolist()
                    # [x1,y1,x2,y2] -> polygon
                    box = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]
                else:
                    box = [[0, 0], [0, 0], [0, 0], [0, 0]]
                lines.append((box, (str(text), conf)))
            continue

        # Classic list-of-[bbox, (text, conf)]
        if isinstance(page, (list, tuple)):
            for line in page:
                if not line or not isinstance(line, (list, tuple)) or len(line) < 2:
                    continue
                bbox_raw, rec = line[0], line[1]
                if isinstance(rec, (list, tuple)) and len(rec) >= 2:
                    lines.append((bbox_raw, (str(rec[0]), float(rec[1]))))
    return lines


def _polygon_to_bbox(poly: list) -> dict[str, float]:
    xs: list[float] = []
    ys: list[float] = []
    # numpy array Nx2
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
        "x": round(min_x, 2),
        "y": round(min_y, 2),
        "width": round(max_x - min_x, 2),
        "height": round(max_y - min_y, 2),
    }


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
        "image/png": "png",
        "image/jpeg": "jpeg",
        "image/jpg": "jpeg",
        "image/gif": "gif",
        "image/bmp": "bmp",
        "image/webp": "webp",
        "image/avif": "avif",
        "image/tiff": "tiff",
        "image/tif": "tiff",
        "image/x-tiff": "tiff",
        "image/x-icon": "ico",
        "image/vnd.microsoft.icon": "ico",
        "image/x-portable-pixmap": "ppm",
        "application/pdf": "pdf",
    }
    if mime in mime_map:
        return mime_map[mime]
    raise HTTPException(400, "Formato no soportado")


def _pdf_first_page_to_pil(data: bytes) -> Image.Image:
    try:
        import pypdfium2 as pdfium
    except ImportError as exc:
        raise HTTPException(500, "Falta pypdfium2 para PDF") from exc
    pdf = pdfium.PdfDocument(data)
    if len(pdf) < 1:
        raise HTTPException(400, "PDF vacío")
    page = pdf[0]
    bitmap = page.render(scale=2)
    return bitmap.to_pil()


def _normalize_to_png(data: bytes, kind: str, image_id: str) -> Path:
    """Convierte cualquier formato aceptado a PNG RGB para OCR y preview."""
    out = UPLOAD_DIR / f"{image_id}.png"
    try:
        if kind == "pdf":
            img = _pdf_first_page_to_pil(data)
        else:
            from io import BytesIO

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


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/image/{image_id}")
def get_image(image_id: str):
    if image_id not in store:
        raise HTTPException(404, "Imagen no encontrada")
    path = Path(store[image_id]["path"])
    if not path.exists():
        raise HTTPException(404, "Archivo no encontrado")
    return FileResponse(path, media_type="image/png", filename=f"{image_id}.png")


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    content_type = (file.content_type or "").lower()
    data = await file.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(400, "Archivo supera 20MB")

    filename = file.filename or "document"
    kind = _detect_format(data, filename, content_type)
    if kind not in {
        "png",
        "jpeg",
        "gif",
        "bmp",
        "webp",
        "avif",
        "tiff",
        "ico",
        "ppm",
        "pdf",
    }:
        raise HTTPException(400, "Formato no soportado")

    image_id = str(uuid.uuid4())
    path = _normalize_to_png(data, kind, image_id)

    store[image_id] = {
        "path": str(path),
        "filename": filename,
        "status": "pending",
        "result": None,
        "source_format": kind,
    }
    return {
        "image_id": image_id,
        "filename": filename,
        "preview_url": f"/image/{image_id}",
        "source_format": kind,
    }


@app.post("/infer/{image_id}", response_model=OCRResult)
def infer(image_id: str):
    if image_id not in store:
        raise HTTPException(404, "Imagen no encontrada")

    item = store[image_id]
    item["status"] = "processing"

    try:
        start = time.time()
        lines = _run_paddle(item["path"])
        elapsed = round((time.time() - start) * 1000, 1)

        with Image.open(item["path"]) as img:
            w, h = img.size

        regions: list[Region] = []
        for i, (bbox_raw, (text, conf)) in enumerate(lines):
            regions.append(
                Region(
                    id=i,
                    text=text,
                    confidence=round(float(conf), 3),
                    bbox=_polygon_to_bbox(bbox_raw),
                )
            )

        confs = [r.confidence for r in regions]
        result = OCRResult(
            image_id=image_id,
            filename=item["filename"],
            status="completed",
            inference_time_ms=elapsed,
            confidence_avg=round(sum(confs) / len(confs), 3) if confs else 0.0,
            regions_count=len(regions),
            low_confidence_count=len([c for c in confs if c < 0.9]),
            regions=regions,
            width=w,
            height=h,
        )
        item["status"] = "completed"
        item["result"] = result.model_dump()
        return result
    except Exception as exc:
        item["status"] = "error"
        item["error"] = str(exc)
        raise HTTPException(500, f"Error OCR: {exc}") from exc


@app.post("/infer/batch", response_model=list[OCRResult])
def infer_batch(body: BatchRequest):
    results: list[OCRResult] = []
    for iid in body.image_ids:
        if iid in store and store[iid]["status"] in ("pending", "error", "completed"):
            results.append(infer(iid))
    return results


@app.get("/status/{image_id}")
def status(image_id: str):
    if image_id not in store:
        raise HTTPException(404, "Imagen no encontrada")
    return {"image_id": image_id, "status": store[image_id]["status"]}
