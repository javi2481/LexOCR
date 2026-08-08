"""Registro de rutas FastAPI."""

import asyncio
import time
import uuid
from pathlib import Path

from fastapi import Body, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image

from . import ocr
from .annotate import render_annotated_from_result
from .ocr import _run_paddle
from .orientation import _rescue_oriented_lines
from .parsing import _build_result
from .schemas import BatchRequest, InferOptions, OCRResult
from .storage import (
    ANNOTATED_DIR,
    DOCUMENT_KINDS,
    IMAGE_KINDS,
    MAX_PAGES,
    _detect_format,
    _normalize_to_png,
    _pdf_page_count,
    _pdf_page_to_png,
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
    *,
    rescue: bool = True,
) -> OCRResult:
    path = Path(item["path"])
    orientations = None
    if rescue:
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
    """PDF/TIFF: guardar original → rasterizar páginas a PNG → pages[] pending.

    El OCR corre después vía /infer (Run / Run All) para progreso real por página.
    """
    parent_id = str(uuid.uuid4())
    original = _save_original(data, parent_id, kind)

    try:
        if kind == "pdf":
            n_pages = _pdf_page_count(original)
        else:
            n_pages = _tiff_frame_count(original)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, f"No se pudo leer el documento: {exc}") from exc

    if n_pages < 1:
        raise HTTPException(400, "No se pudo leer ninguna página del documento")
    if n_pages > MAX_PAGES:
        raise HTTPException(
            400, f"El documento supera el tope de {MAX_PAGES} páginas",
        )

    page_count = n_pages
    out_pages: list[dict] = []
    first_id: str | None = None

    for page_index in range(page_count):
        image_id = str(uuid.uuid4())
        if first_id is None:
            first_id = image_id
        display_name = _page_filename(filename, page_index, page_count)
        try:
            if kind == "pdf":
                path = _pdf_page_to_png(original, page_index, image_id)
            else:
                path = _tiff_frame_to_png(original, page_index, image_id)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                500, f"Error al rasterizar página {page_index + 1}: {exc}",
            ) from exc

        store[image_id] = {
            "path": str(path),
            "filename": display_name,
            "status": "pending",
            "result": None,
            "source_format": kind,
            "page_index": int(page_index),
            "page_count": page_count,
            "parent_id": parent_id,
            "original_path": str(original),
            "last_options": None,
        }
        out_pages.append({
            "image_id": image_id,
            "page_index": int(page_index),
            "page_count": page_count,
            "filename": display_name,
            "status": "pending",
            "preview_url": f"/image/{image_id}",
            "source_format": kind,
        })

    store[parent_id] = {
        "path": str(original),
        "filename": filename,
        "status": "completed",
        "result": None,
        "source_format": kind,
        "page_count": page_count,
        "is_document_source": True,
        "last_options": None,
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
        """PNG con bounding boxes dibujados desde el OCRResult ya guardado (sin re-OCR)."""
        if image_id not in store:
            raise HTTPException(404, "Imagen no encontrada")
        item = store[image_id]
        path = Path(item["path"])
        if not path.exists():
            raise HTTPException(404, "Archivo no encontrado")
        if item.get("is_document_source"):
            raise HTTPException(400, "Exportá una página concreta, no el documento original")
        result = item.get("result")
        if not result or not isinstance(result, dict):
            raise HTTPException(400, "Sin resultado OCR. Ejecutá Run antes de exportar PNG.")
        out_dir = ANNOTATED_DIR / image_id
        out_dir.mkdir(parents=True, exist_ok=True)
        out_file = out_dir / "annotated.png"
        try:
            render_annotated_from_result(path, result, out_file)
        except Exception as exc:
            raise HTTPException(500, f"Error al generar PNG anotado: {exc}") from exc
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
            # OCR documento es CPU-bound; no bloquear el event loop (health/API).
            return await asyncio.to_thread(
                _process_document_upload, data, filename, kind,
            )

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
            # Rescue angular: útil en fotos; en PDF/TIFF densos multiplica el tiempo.
            do_rescue = item.get("source_format") not in DOCUMENT_KINDS
            return _finalize_page_ocr(
                image_id, item, lines, textline_angles, elapsed, options,
                rescue=do_rescue,
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
