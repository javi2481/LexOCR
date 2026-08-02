"""Inicialización y ejecución de PaddleOCR."""

from pathlib import Path
from typing import Any

from PIL import Image

from .parsing import _parse_paddle_raw
from .schemas import InferOptions
from .storage import UPLOAD_DIR, _array_to_png

_DEVICE_INFO: dict[str, Any] = {"cuda_compiled": False, "device": "cpu"}
_ocr_engine: Any | None = None
_ocr_doc_engine: Any | None = None
_rec_engine: Any | None = None

OCR_TIER = "medium"


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


def _create_paddle_ocr(
    *,
    use_doc_orientation_classify: bool,
    use_doc_unwarping: bool,
) -> Any:
    """Crea un PaddleOCR PP-OCRv6 medium con drop progresivo de kwargs no soportados."""
    from paddleocr import PaddleOCR
    if not _DEVICE_INFO.get("device"):
        _refresh_device_info()
    kwargs: dict[str, Any] = {
        "ocr_version": "PP-OCRv6",
        "use_doc_orientation_classify": use_doc_orientation_classify,
        "use_doc_unwarping": use_doc_unwarping,
        # Nombre 3.x del obsoleto use_angle_cls; solo clasifica 0/180.
        "use_textline_orientation": True,
        "text_detection_model_name": f"PP-OCRv6_{OCR_TIER}_det",
        "text_recognition_model_name": f"PP-OCRv6_{OCR_TIER}_rec",
        "device": _DEVICE_INFO["device"],
        # oneDNN/mkldnn rompe predict en algunos builds Windows (PIR Unimplemented)
        "enable_mkldnn": False,
    }
    drop_order = (
        "enable_mkldnn", "device", "text_detection_model_name",
        "text_recognition_model_name", "ocr_version",
    )
    attempt = dict(kwargs)
    while True:
        try:
            return PaddleOCR(**attempt)
        except TypeError:
            dropped = False
            for name in drop_order:
                if name in attempt:
                    attempt.pop(name)
                    dropped = True
                    break
            if not dropped:
                return PaddleOCR()
        except Exception:
            if "text_detection_model_name" in attempt:
                attempt.pop("text_detection_model_name", None)
                attempt.pop("text_recognition_model_name", None)
                continue
            raise


def get_ocr():
    """Lazy-init PaddleOCR PP-OCRv6 medium escena (sin orientation/unwarping de página)."""
    global _ocr_engine
    if _ocr_engine is not None:
        return _ocr_engine
    _ocr_engine = _create_paddle_ocr(
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
    )
    return _ocr_engine


def get_ocr_document():
    """Lazy-init PaddleOCR PP-OCRv6 medium documento (orientation + unwarping ON)."""
    global _ocr_doc_engine
    if _ocr_doc_engine is not None:
        return _ocr_doc_engine
    _ocr_doc_engine = _create_paddle_ocr(
        use_doc_orientation_classify=True,
        use_doc_unwarping=True,
    )
    return _ocr_doc_engine


def engines_cached_count() -> int:
    return sum(1 for e in (_ocr_engine, _ocr_doc_engine) if e is not None)


def get_recognizer():
    """Lazy-init del módulo oficial TextRecognition (medium), segundo pase."""
    global _rec_engine
    if _rec_engine is not None:
        return _rec_engine
    from paddleocr import TextRecognition
    if not _DEVICE_INFO.get("device"):
        _refresh_device_info()
    kwargs: dict[str, Any] = {
        "model_name": f"PP-OCRv6_{OCR_TIER}_rec",
        "device": _DEVICE_INFO["device"],
        "enable_mkldnn": False,
    }
    for drop in ("enable_mkldnn", "device", "model_name"):
        try:
            _rec_engine = TextRecognition(**kwargs)
            return _rec_engine
        except TypeError:
            kwargs.pop(drop, None)
    _rec_engine = TextRecognition()
    return _rec_engine


def _warmup_default_engine() -> None:
    """Carga el engine default e infiere una imagen dummy (patrón de despliegue)."""
    _refresh_device_info()
    engine = get_ocr()
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


def _call_predict(engine: Any, path: str, options: InferOptions | None) -> Any:
    """Invoca predict() con kwargs oficiales; drop progresivo si la API rechaza alguno."""
    pred_kwargs = _predict_kwargs(options) if options is not None else {}
    drop_order = (
        "text_det_limit_type", "text_det_limit_side_len", "text_det_unclip_ratio",
        "text_det_box_thresh", "text_det_thresh",
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


def _as_result_list(raw: Any) -> list[Any]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [p for p in raw if p is not None]
    return [raw]


def _page_index_of(page: Any, fallback: int) -> int:
    data = page
    if hasattr(page, "get"):
        val = page.get("page_index")
        if val is not None:
            return int(val)
    val = getattr(page, "page_index", None)
    if val is not None:
        return int(val)
    if hasattr(page, "json"):
        js = page.json
        if callable(js):
            js = js()
        if isinstance(js, dict):
            nested = js.get("res", js)
            if isinstance(nested, dict) and nested.get("page_index") is not None:
                return int(nested["page_index"])
            if js.get("page_index") is not None:
                return int(js["page_index"])
    return fallback


def _extract_page_image(page: Any) -> Any | None:
    """Intenta obtener la imagen de página (post-preprocess) del Result Paddle."""
    candidates: list[Any] = []
    img_attr = getattr(page, "img", None)
    if callable(img_attr):
        try:
            img_attr = img_attr()
        except Exception:
            img_attr = None
    if isinstance(img_attr, dict):
        for key in (
            "preprocessed_img", "doc_preprocessor_res", "input_img",
            "ocr_res_img", "output_img",
        ):
            if key in img_attr and img_attr[key] is not None:
                candidates.append(img_attr[key])
        for val in img_attr.values():
            if val is not None:
                candidates.append(val)
    elif img_attr is not None:
        candidates.append(img_attr)

    for key in ("output_img", "input_img", "doc_preprocessor_res"):
        val = page.get(key) if hasattr(page, "get") else getattr(page, key, None)
        if isinstance(val, dict):
            candidates.append(val.get("output_img") or val.get("img"))
        elif val is not None:
            candidates.append(val)

    if hasattr(page, "json"):
        js = page.json
        if callable(js):
            try:
                js = js()
            except Exception:
                js = None
        if isinstance(js, dict):
            res = js.get("res", js)
            if isinstance(res, dict):
                pre = res.get("doc_preprocessor_res")
                if isinstance(pre, dict):
                    candidates.append(pre.get("output_img"))
                candidates.append(res.get("input_img"))

    for cand in candidates:
        if cand is None:
            continue
        if isinstance(cand, dict):
            inner = cand.get("output_img") or cand.get("img") or cand.get("input_img")
            if inner is not None:
                return inner
            continue
        return cand
    return None


def _materialize_page_png(
    page: Any,
    image_id: str,
    *,
    tiff_path: Path | None = None,
    frame_index: int = 0,
) -> Path:
    """PNG de preview por página vía imagen del Result o fallback TIFF/save_to_img."""
    from .storage import _tiff_frame_to_png

    extracted = _extract_page_image(page)
    if extracted is not None:
        saved = _array_to_png(extracted, image_id)
        if saved is not None:
            return saved

    if tiff_path is not None:
        try:
            return _tiff_frame_to_png(tiff_path, frame_index, image_id)
        except Exception as exc:
            print(f"[preview] tiff frame fallback failed: {exc}")

    out = UPLOAD_DIR / f"{image_id}.png"
    tmp_dir = UPLOAD_DIR / f"_preview_{image_id}"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    try:
        if hasattr(page, "save_to_img"):
            try:
                page.save_to_img(str(tmp_dir))
            except TypeError:
                page.save_to_img(save_path=str(tmp_dir))
            candidates = sorted(
                [
                    p for p in tmp_dir.iterdir()
                    if p.is_file() and p.suffix.lower() in (".png", ".jpg", ".jpeg")
                ],
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
            if candidates:
                img = Image.open(candidates[0])
                img.convert("RGB").save(out, format="PNG")
                return out
    finally:
        try:
            for p in tmp_dir.iterdir():
                p.unlink(missing_ok=True)
            tmp_dir.rmdir()
        except Exception:
            pass

    # Placeholder mínimo si no hay forma de materializar (no debería llegar aquí).
    Image.new("RGB", (64, 64), color=(245, 245, 245)).save(out, format="PNG")
    return out


def _run_paddle(
    path: str,
    options: InferOptions | None = None,
) -> tuple[list[tuple[list, tuple[str, float]]], list[int]]:
    engine = get_ocr()
    raw = _call_predict(engine, path, options)
    return _parse_paddle_raw(raw)


def _run_paddle_document(
    path: str,
    options: InferOptions | None = None,
) -> list[Any]:
    """predict multipágina con engine documento; lista de Results."""
    engine = get_ocr_document()
    raw = _call_predict(engine, path, options)
    return _as_result_list(raw)
