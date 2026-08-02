"""Registro de rutas FastAPI."""

import time
import uuid
from pathlib import Path

from fastapi import Body, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image

from . import ocr
from .ocr import _call_predict, _run_paddle, get_ocr
from .orientation import _rescue_oriented_lines
from .parsing import _build_result
from .schemas import BatchRequest, InferOptions, OCRResult
from .storage import (
    ANNOTATED_DIR,
    IMAGE_KINDS,
    _detect_format,
    _normalize_to_png,
    store,
)


def register_routes(app: FastAPI) -> None:
    """Registra todos los endpoints de la aplicación."""

    @app.get("/health")
    def health():
        info = ocr._DEVICE_INFO if ocr._DEVICE_INFO.get("device") else ocr._refresh_device_info()
        return {
            "ok": True,
            "cuda_compiled": bool(info.get("cuda_compiled")),
            "device": info.get("device", "cpu"),
            "engines_cached": 1 if ocr._ocr_engine is not None else 0,
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
            lines, textline_angles = _run_paddle(item["path"], options)
            try:
                lines, orientations = _rescue_oriented_lines(
                    item["path"], lines, textline_angles,
                )
            except Exception as exc:
                # El segundo pase es una mejora: si falla, se conserva la lectura del pipeline.
                print(f"[rescue] skipped: {exc}")
                orientations = None
            elapsed = round((time.time() - start) * 1000, 1)
            with Image.open(item["path"]) as img:
                w, h = img.size
            result = _build_result(
                image_id, item, lines, elapsed, w, h, options, orientations,
            )
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
