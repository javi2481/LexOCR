"""IDP OCR Studio — FastAPI + PaddleOCR (single file)."""

from __future__ import annotations

import os
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Literal

# Cache de PaddleX dentro del proyecto (evita escribir en ~/.paddlex)
_ROOT = Path(__file__).resolve().parent
_PADDLEX = _ROOT / ".paddlex"
_PADDLEX.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("PADDLE_PDX_CACHE_HOME", str(_PADDLEX))
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

from fastapi import Body, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from PIL import Image

UPLOAD_DIR = _ROOT / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
ANNOTATED_DIR = UPLOAD_DIR / "annotated"
ANNOTATED_DIR.mkdir(exist_ok=True)

# Runtime device (cpu / gpu:0) — detectado una vez
_DEVICE_INFO: dict[str, Any] = {
    "cuda_compiled": False,
    "device": "cpu",
}

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
}

IMAGE_KINDS = frozenset(
    {"png", "jpeg", "gif", "bmp", "webp", "avif", "tiff", "ico", "ppm"}
)

MAGIC_PREFIXES = (
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"\xff\xd8\xff", "jpeg"),
    (b"GIF87a", "gif"),
    (b"GIF89a", "gif"),
    (b"BM", "bmp"),
    (b"II*\x00", "tiff"),
    (b"MM\x00*", "tiff"),
)

OcrMode = Literal["fast", "document"]
OcrTier = Literal["tiny", "small", "medium"]

# image_id -> metadata
store: dict[str, dict[str, Any]] = {}

# (mode, tier) -> PaddleOCR instance
_ocr_cache: dict[tuple[str, str], Any] = {}


def _detect_device() -> dict[str, Any]:
    """Detecta CUDA / device según API oficial paddle.is_compiled_with_cuda()."""
    cuda = False
    device = "cpu"
    try:
        import paddle

        cuda = bool(paddle.is_compiled_with_cuda())
        if cuda:
            try:
                count = int(paddle.device.cuda.device_count())
                device = "gpu:0" if count > 0 else "cpu"
                if count <= 0:
                    cuda = False
            except Exception:
                device = "gpu:0"
    except Exception:
        pass
    return {"cuda_compiled": cuda, "device": device}


def _refresh_device_info() -> dict[str, Any]:
    global _DEVICE_INFO
    _DEVICE_INFO = _detect_device()
    return _DEVICE_INFO


class InferOptions(BaseModel):
    mode: OcrMode = "fast"
    tier: OcrTier = "medium"
    # Solo UI/métricas (low_confidence_count, colores). No corta el motor.
    conf_threshold: float = Field(default=0.9, ge=0.5, le=0.99)
    # Defaults recall-first (scene/display). None omite el param → default Paddle.
    text_det_box_thresh: float | None = 0.35
    text_det_thresh: float | None = 0.20
    text_det_unclip_ratio: float | None = 2.0
    text_det_limit_side_len: int | None = 1152
    text_det_limit_type: str | None = "min"


def _predict_kwargs(options: InferOptions) -> dict[str, Any]:
    """Kwargs oficiales para predict(). No envía text_rec_score_thresh (default Paddle 0.0)."""
    mapping: dict[str, Any] = {
        "text_det_box_thresh": options.text_det_box_thresh,
        "text_det_thresh": options.text_det_thresh,
        "text_det_unclip_ratio": options.text_det_unclip_ratio,
        "text_det_limit_side_len": options.text_det_limit_side_len,
        "text_det_limit_type": options.text_det_limit_type,
    }
    return {k: v for k, v in mapping.items() if v is not None}


def get_ocr(mode: OcrMode = "fast", tier: OcrTier = "medium"):
    """Lazy-init PaddleOCR PP-OCRv6 keyed by mode + tier."""
    key = (mode, tier)
    if key in _ocr_cache:
        return _ocr_cache[key]

    from paddleocr import PaddleOCR

    if not _DEVICE_INFO.get("device"):
        _refresh_device_info()

    document = mode == "document"
    kwargs: dict[str, Any] = {
        "ocr_version": "PP-OCRv6",
        "use_doc_orientation_classify": document,
        "use_doc_unwarping": False,
        "use_textline_orientation": True,
        "text_detection_model_name": f"PP-OCRv6_{tier}_det",
        "text_recognition_model_name": f"PP-OCRv6_{tier}_rec",
        "device": _DEVICE_INFO["device"],
        # oneDNN/mkldnn rompe predict en algunos builds Windows (PIR Unimplemented)
        "enable_mkldnn": False,
    }

    engine = None
    # Progressive fallback if installed API rejects some kwargs
    drop_order = (
        "enable_mkldnn",
        "device",
        "text_detection_model_name",
        "text_recognition_model_name",
        "ocr_version",
    )
    attempt = dict(kwargs)
    while True:
        try:
            engine = PaddleOCR(**attempt)
            break
        except TypeError:
            dropped = False
            for name in drop_order:
                if name in attempt:
                    attempt.pop(name)
                    dropped = True
                    break
            if not dropped:
                engine = PaddleOCR()
                break
        except Exception:
            if "text_detection_model_name" in attempt:
                attempt.pop("text_detection_model_name", None)
                attempt.pop("text_recognition_model_name", None)
                continue
            raise

    _ocr_cache[key] = engine
    return engine


def _warmup_default_engine() -> None:
    """Carga el engine default e infiere una imagen dummy (patrón de despliegue)."""
    _refresh_device_info()
    engine = get_ocr("fast", "medium")
    dummy = UPLOAD_DIR / "_warmup.png"
    Image.new("RGB", (32, 32), color=(255, 255, 255)).save(dummy, format="PNG")
    try:
        if hasattr(engine, "predict"):
            engine.predict(str(dummy))
        elif hasattr(engine, "ocr"):
            try:
                engine.ocr(str(dummy), cls=True)
            except TypeError:
                engine.ocr(str(dummy))
    finally:
        try:
            dummy.unlink(missing_ok=True)
        except Exception:
            pass


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        _warmup_default_engine()
    except Exception as exc:
        # No bloquear el arranque si el warmup falla (modelos aún no descargados, etc.)
        print(f"[warmup] skipped: {exc}")
    yield


app = FastAPI(title="IDP OCR Studio", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Region(BaseModel):
    id: int
    text: str
    confidence: float
    bbox: dict[str, float]
    poly: list[list[float]] = Field(default_factory=list)


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
    ocr_mode: OcrMode = "fast"
    ocr_tier: OcrTier = "medium"
    conf_threshold: float = 0.9


class BatchRequest(InferOptions):
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
    out: dict[str, Any] = {}
    for key in ("rec_texts", "rec_scores", "rec_polys", "dt_polys", "rec_boxes"):
        if hasattr(page, "get"):
            val = page.get(key)
        else:
            val = getattr(page, key, None)
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


def _call_predict(engine: Any, path: str, options: InferOptions | None) -> Any:
    """Invoca predict() con kwargs oficiales; drop progresivo si la API rechaza alguno."""
    pred_kwargs = _predict_kwargs(options) if options is not None else {}
    drop_order = (
        "text_det_limit_type",
        "text_det_limit_side_len",
        "text_det_unclip_ratio",
        "text_det_box_thresh",
        "text_det_thresh",
    )
    if hasattr(engine, "predict"):
        attempt = dict(pred_kwargs)
        while True:
            try:
                return engine.predict(path, **attempt) if attempt else engine.predict(path)
            except TypeError:
                dropped = False
                for name in drop_order:
                    if name in attempt:
                        print(f"[predict] dropping unsupported kwarg: {name}")
                        attempt.pop(name)
                        dropped = True
                        break
                if not dropped:
                    break
    try:
        return engine.ocr(path, cls=True)
    except TypeError:
        return engine.ocr(path)


def _parse_paddle_raw(raw: Any) -> list[tuple[list, tuple[str, float]]]:
    """Normalize PaddleOCR output to [(polygon, (text, conf)), ...].

    Prefer dt_polys as master list so every detection becomes a region,
    even when recognition is empty or missing.
    """
    lines: list[tuple[list, tuple[str, float]]] = []
    if not raw:
        return lines

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
            continue

        if isinstance(page, (list, tuple)):
            for line in page:
                if not line or not isinstance(line, (list, tuple)) or len(line) < 2:
                    continue
                bbox_raw, rec = line[0], line[1]
                if isinstance(rec, (list, tuple)) and len(rec) >= 2:
                    lines.append((bbox_raw, (str(rec[0]), float(rec[1]))))
    return lines


def _run_paddle(
    path: str,
    mode: OcrMode = "fast",
    tier: OcrTier = "medium",
    options: InferOptions | None = None,
) -> list[tuple[list, tuple[str, float]]]:
    engine = get_ocr(mode, tier)
    raw = _call_predict(engine, path, options)
    return _parse_paddle_raw(raw)


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
        "x": round(min_x, 2),
        "y": round(min_y, 2),
        "width": round(max_x - min_x, 2),
        "height": round(max_y - min_y, 2),
    }


def _detect_format(data: bytes, filename: str, content_type: str) -> str:
    """Detecta formato por magic bytes, extensión o MIME."""
    if data.startswith(b"%PDF"):
        raise HTTPException(400, "Solo imágenes; PDF no soportado")

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
    if ext == "pdf":
        raise HTTPException(400, "Solo imágenes; PDF no soportado")
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
    if mime == "application/pdf":
        raise HTTPException(400, "Solo imágenes; PDF no soportado")
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
    }
    if mime in mime_map:
        return mime_map[mime]
    raise HTTPException(400, "Formato no soportado")


def _normalize_to_png(data: bytes, kind: str, image_id: str) -> Path:
    """Convierte cualquier formato de imagen aceptado a PNG RGB para OCR y preview."""
    out = UPLOAD_DIR / f"{image_id}.png"
    try:
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


def _build_result(
    image_id: str,
    item: dict[str, Any],
    lines: list[tuple[list, tuple[str, float]]],
    elapsed: float,
    width: int,
    height: int,
    options: InferOptions,
) -> OCRResult:
    regions: list[Region] = []
    for i, (bbox_raw, (text, conf)) in enumerate(lines):
        poly = _normalize_poly(bbox_raw)
        regions.append(
            Region(
                id=i,
                text=text,
                confidence=round(float(conf), 3),
                bbox=_polygon_to_bbox(bbox_raw),
                poly=poly,
            )
        )

    confs = [r.confidence for r in regions]
    thr = options.conf_threshold
    return OCRResult(
        image_id=image_id,
        filename=item["filename"],
        status="completed",
        inference_time_ms=elapsed,
        confidence_avg=round(sum(confs) / len(confs), 3) if confs else 0.0,
        regions_count=len(regions),
        low_confidence_count=len([c for c in confs if c < thr]),
        regions=regions,
        width=width,
        height=height,
        ocr_mode=options.mode,
        ocr_tier=options.tier,
        conf_threshold=thr,
    )


@app.get("/health")
def health():
    info = _DEVICE_INFO if _DEVICE_INFO.get("device") else _refresh_device_info()
    return {
        "ok": True,
        "cuda_compiled": bool(info.get("cuda_compiled")),
        "device": info.get("device", "cpu"),
        "engines_cached": len(_ocr_cache),
    }


@app.get("/image/{image_id}")
def get_image(image_id: str):
    if image_id not in store:
        raise HTTPException(404, "Imagen no encontrada")
    path = Path(store[image_id]["path"])
    if not path.exists():
        raise HTTPException(404, "Archivo no encontrado")
    return FileResponse(path, media_type="image/png", filename=f"{image_id}.png")


@app.get("/export/{image_id}/annotated")
def export_annotated(image_id: str):
    """PNG con bounding boxes vía result.save_to_img() (API oficial)."""
    if image_id not in store:
        raise HTTPException(404, "Imagen no encontrada")
    item = store[image_id]
    path = Path(item["path"])
    if not path.exists():
        raise HTTPException(404, "Archivo no encontrado")

    raw_opts = item.get("last_options") or {}
    try:
        options = InferOptions(**raw_opts)
    except Exception:
        options = InferOptions()

    engine = get_ocr(options.mode, options.tier)
    try:
        raw = _call_predict(engine, str(path), options)
    except Exception as exc:
        raise HTTPException(500, f"Error OCR al anotar: {exc}") from exc

    if not raw:
        raise HTTPException(404, "Sin resultado OCR para anotar")

    out_dir = ANNOTATED_DIR / image_id
    if out_dir.exists():
        for old in out_dir.iterdir():
            try:
                old.unlink()
            except Exception:
                pass
    else:
        out_dir.mkdir(parents=True, exist_ok=True)

    pages = raw if isinstance(raw, list) else [raw]
    saved = False
    for page in pages:
        if page is None:
            continue
        if hasattr(page, "save_to_img"):
            try:
                page.save_to_img(str(out_dir))
                saved = True
            except TypeError:
                page.save_to_img(save_path=str(out_dir))
                saved = True

    if not saved:
        raise HTTPException(501, "save_to_img no disponible en este resultado")

    candidates = sorted(
        [p for p in out_dir.iterdir() if p.is_file() and p.suffix.lower() in (".png", ".jpg", ".jpeg")],
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        candidates = sorted([p for p in out_dir.iterdir() if p.is_file()], key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        raise HTTPException(500, "No se generó imagen anotada")

    out_file = candidates[0]
    stem = Path(item.get("filename") or image_id).stem
    return FileResponse(
        out_file,
        media_type="image/png",
        filename=f"{stem}_annotated.png",
    )


@app.post("/upload")
async def upload(file: UploadFile = File(...)):
    content_type = (file.content_type or "").lower()
    data = await file.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(400, "Archivo supera 20MB")

    filename = file.filename or "image"
    kind = _detect_format(data, filename, content_type)
    if kind not in IMAGE_KINDS:
        raise HTTPException(400, "Solo imágenes; PDF no soportado")

    image_id = str(uuid.uuid4())
    path = _normalize_to_png(data, kind, image_id)

    store[image_id] = {
        "path": str(path),
        "filename": filename,
        "status": "pending",
        "result": None,
        "source_format": kind,
        "last_options": None,
    }
    return {
        "image_id": image_id,
        "filename": filename,
        "preview_url": f"/image/{image_id}",
        "source_format": kind,
    }


@app.post("/infer/batch", response_model=list[OCRResult])
def infer_batch(body: BatchRequest):
    # Must be registered before /infer/{image_id} so "batch" is not captured as an id.
    options = InferOptions(
        mode=body.mode,
        tier=body.tier,
        conf_threshold=body.conf_threshold,
        text_det_box_thresh=body.text_det_box_thresh,
        text_det_thresh=body.text_det_thresh,
        text_det_unclip_ratio=body.text_det_unclip_ratio,
        text_det_limit_side_len=body.text_det_limit_side_len,
        text_det_limit_type=body.text_det_limit_type,
    )
    results: list[OCRResult] = []
    for iid in body.image_ids:
        if iid in store and store[iid]["status"] in ("pending", "error", "completed"):
            results.append(infer(iid, options))
    return results


@app.post("/infer/{image_id}", response_model=OCRResult)
def infer(image_id: str, options: InferOptions = Body(default_factory=InferOptions)):
    if image_id not in store:
        raise HTTPException(404, "Imagen no encontrada")

    item = store[image_id]
    item["status"] = "processing"
    item["last_options"] = options.model_dump()

    try:
        start = time.time()
        lines = _run_paddle(item["path"], options.mode, options.tier, options)
        elapsed = round((time.time() - start) * 1000, 1)

        with Image.open(item["path"]) as img:
            w, h = img.size

        result = _build_result(image_id, item, lines, elapsed, w, h, options)
        item["status"] = "completed"
        item["result"] = result.model_dump()
        return result
    except Exception as exc:
        item["status"] = "error"
        item["error"] = str(exc)
        raise HTTPException(500, f"Error OCR: {exc}") from exc


@app.get("/status/{image_id}")
def status(image_id: str):
    if image_id not in store:
        raise HTTPException(404, "Imagen no encontrada")
    return {"image_id": image_id, "status": store[image_id]["status"]}
