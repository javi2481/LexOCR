"""Registro de rutas FastAPI."""

import time
import uuid
from pathlib import Path

from fastapi import Body, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image

from . import ocr
from .ocr import (
    _call_predict,
    _materialize_page_png,
    _page_index_of,
    _run_paddle,
    _run_paddle_document,
    get_ocr,
)
from .orientation import _rescue_oriented_lines
from .parsing import _build_result, _parse_paddle_raw
from .schemas import BatchRequest, InferOptions, OCRResult
from .storage import (
    ANNOTATED_DIR,
    DOCUMENT_KINDS,
    IMAGE_KINDS,
    MAX_PAGES,
    _detect_format,
    _normalize_to_png,
    _save_original,
    _tiff_frame_count,
    _tiff_frame_to_png,
    store,
)


def _page_filename(base: str, page_index: int, page_count: int) -> str:
    stem = Path(base).stem or base
    return f"{stem} · p.{page_index + 1}/{page_count}"


def _finalize_page_ocr(
    image_id: str,
    item: dict,
    lines: list,
    textline_angles: list[int],
    elapsed_ms: float,
    options: InferOptions,
) -> OCRResult:
    path = Path(item["path"])
    try:
        lines, orientations = _rescue_oriented_lines(str(path), lines, textline_angles)
    except Exception as exc:
        print(f"[rescue] skipped: {exc}")
        orientations = None
    with Image.open(path) as img:
        w, h = img.size
    result = _build_result(
        image_id, item, lines, elapsed_ms, w, h, options, orientations,
    )
    item["status"] = "completed"
    item["result"] = result.model_dump()
    return result


def _process_document_upload(
    data: bytes,
    filename: str,
    kind: str,
) -> dict:
    """PDF/TIFF: guardar original → predict documento → N páginas con preview + OCR + rescue."""
    options = InferOptions()
    parent_id = str(uuid.uuid4())
    original = _save_original(data, parent_id, kind)
    start = time.time()

    try:
        pages_raw = _run_paddle_document(str(original), options)
    except Exception as exc:
        raise HTTPException(500, f"Error OCR documento: {exc}") from exc

    normalized: list[tuple[int, object | None, Path | None]] = []

    # TIFF: si Paddle no pagina, partir frames con Pillow y predecir cada PNG.
    if kind == "tiff":
        n_frames = _tiff_frame_count(original)
        if n_frames > 1 and len(pages_raw) <= 1:
            for fi in range(min(n_frames, MAX_PAGES + 1)):
                if fi >= MAX_PAGES:
                    break
                frame_id = str(uuid.uuid4())
                frame_png = _tiff_frame_to_png(original, fi, frame_id)
                try:
                    frame_pages = _run_paddle_document(str(frame_png), options)
                except Exception:
                    frame_pages = ocr._as_result_list(
                        _call_predict(get_ocr(), str(frame_png), options)
                    )
                page = frame_pages[0] if frame_pages else None
                normalized.append((fi, page, frame_png))
        else:
            normalized = [
                (_page_index_of(page, i), page, None)
                for i, page in enumerate(pages_raw)
            ]
    else:
        normalized = [
            (_page_index_of(page, i), page, None)
            for i, page in enumerate(pages_raw)
        ]

    if len(normalized) > MAX_PAGES:
        raise HTTPException(
            400, f"El documento supera el tope de {MAX_PAGES} páginas",
        )
    if not normalized:
        raise HTTPException(400, "No se pudo leer ninguna página del documento")

    page_count = len(normalized)
    elapsed_total = round((time.time() - start) * 1000, 1)
    per_page_ms = round(elapsed_total / page_count, 1) if page_count else elapsed_total

    out_pages: list[dict] = []
    first_id: str | None = None

    for page_index, page, pre_png in normalized:
        image_id = str(uuid.uuid4())
        if first_id is None:
            first_id = image_id
        display_name = _page_filename(filename, page_index, page_count)

        if pre_png is not None and pre_png.exists():
            # Reutilizar PNG del fallback TIFF; renombrar al image_id.
            path = Path(pre_png)
            target = original.parent / f"{image_id}.png"
            if path.resolve() != target.resolve():
                try:
                    path.replace(target)
                except Exception:
                    Image.open(path).convert("RGB").save(target, format="PNG")
                path = target
        else:
            path = _materialize_page_png(
                page,
                image_id,
                tiff_path=original if kind == "tiff" else None,
                frame_index=page_index if kind == "tiff" else 0,
            )

        lines: list = []
        angles: list[int] = []
        if page is not None:
            lines, angles = _parse_paddle_raw([page])

        item = {
            "path": str(path),
            "filename": display_name,
            "status": "processing",
            "result": None,
            "source_format": kind,
            "page_index": int(page_index),
            "page_count": page_count,
            "parent_id": parent_id,
            "original_path": str(original),
            "last_options": options.model_dump(),
        }
        store[image_id] = item
        result = _finalize_page_ocr(
            image_id, item, lines, angles, per_page_ms, options,
        )
        out_pages.append({
            "image_id": image_id,
            "page_index": int(page_index),
            "page_count": page_count,
            "filename": display_name,
            "status": "completed",
            "preview_url": f"/image/{image_id}",
            "source_format": kind,
            "result": result.model_dump(),
        })

    # Guardar metadato del original (sin PNG de escena).
    store[parent_id] = {
        "path": str(original),
        "filename": filename,
        "status": "completed",
        "result": None,
        "source_format": kind,
        "page_count": page_count,
        "is_document_source": True,
        "last_options": options.model_dump(),
    }

    return {
        "image_id": first_id,
        "filename": filename,
        "source_format": kind,
        "page_count": page_count,
        "pages": out_pages,
        "preview_url": f"/image/{first_id}",
    }


def register_routes(app: FastAPI) -> None:
    """Registra todos los endpoints de la aplicación."""

    @app.get("/health")
    def health():
        info = ocr._DEVICE_INFO if ocr._DEVICE_INFO.get("device") else ocr._refresh_device_info()
        return {
            "ok": True,
            "cuda_compiled": bool(info.get("cuda_compiled")),
            "device": info.get("device", "cpu"),
            "engines_cached": ocr.engines_cached_count(),
        }

    @app.get("/image/{image_id}")
    def get_image(image_id: str):
        if image_id not in store:
            raise HTTPException(404, "Imagen no encontrada")
        path = Path(store[image_id]["path"])
        if not path.exists():
            raise HTTPException(404, "Archivo no encontrado")
        suffix = path.suffix.lower()
        if suffix == ".pdf":
            raise HTTPException(404, "Preview solo disponible por página")
        media = "image/png" if suffix == ".png" else "application/octet-stream"
        return FileResponse(path, media_type=media, filename=f"{image_id}{suffix}")

    @app.get("/export/{image_id}/annotated")
    def export_annotated(image_id: str):
        """PNG con bounding boxes vía result.save_to_img() (API oficial)."""
        if image_id not in store:
            raise HTTPException(404, "Imagen no encontrada")
        item = store[image_id]
        path = Path(item["path"])
        if not path.exists():
            raise HTTPException(404, "Archivo no encontrado")
        if item.get("is_document_source"):
            raise HTTPException(400, "Exportá una página concreta, no el documento original")
        raw_opts = item.get("last_options") or {}
        try:
            options = InferOptions(**raw_opts)
        except Exception:
            options = InferOptions()
        engine = get_ocr()
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
            candidates = sorted(
                [p for p in out_dir.iterdir() if p.is_file()],
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
        if not candidates:
            raise HTTPException(500, "No se generó imagen anotada")
        out_file = candidates[0]
        stem = Path(item.get("filename") or image_id).stem
        return FileResponse(
            out_file, media_type="image/png", filename=f"{stem}_annotated.png",
        )

    @app.post("/upload")
    async def upload(file: UploadFile = File(...)):
        content_type = (file.content_type or "").lower()
        data = await file.read()
        if len(data) > 20 * 1024 * 1024:
            raise HTTPException(400, "Archivo supera 20MB")
        filename = file.filename or "image"
        kind = _detect_format(data, filename, content_type)

        if kind in DOCUMENT_KINDS:
            return _process_document_upload(data, filename, kind)

        if kind not in IMAGE_KINDS:
            raise HTTPException(400, "Formato no soportado")
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
            "pages": [
                {
                    "image_id": image_id,
                    "page_index": 0,
                    "page_count": 1,
                    "filename": filename,
                    "status": "pending",
                    "preview_url": f"/image/{image_id}",
                    "source_format": kind,
                }
            ],
        }

    @app.post("/infer/batch", response_model=list[OCRResult])
    def infer_batch(body: BatchRequest):
        # Debe registrarse antes de /infer/{image_id}.
        options = InferOptions(
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
                if store[iid].get("is_document_source"):
                    continue
                results.append(infer(iid, options))
        return results

    @app.post("/infer/{image_id}", response_model=OCRResult)
    def infer(image_id: str, options: InferOptions = Body(default_factory=InferOptions)):
        if image_id not in store:
            raise HTTPException(404, "Imagen no encontrada")
        item = store[image_id]
        if item.get("is_document_source"):
            raise HTTPException(400, "Inferí una página concreta, no el documento original")
        item["status"] = "processing"
        item["last_options"] = options.model_dump()
        try:
            start = time.time()
            lines, textline_angles = _run_paddle(item["path"], options)
            elapsed = round((time.time() - start) * 1000, 1)
            return _finalize_page_ocr(
                image_id, item, lines, textline_angles, elapsed, options,
            )
        except HTTPException:
            raise
        except Exception as exc:
            item["status"] = "error"
            item["error"] = str(exc)
            raise HTTPException(500, f"Error OCR: {exc}") from exc

    @app.get("/status/{image_id}")
    def status(image_id: str):
        if image_id not in store:
            raise HTTPException(404, "Imagen no encontrada")
        return {"image_id": image_id, "status": store[image_id]["status"]}
