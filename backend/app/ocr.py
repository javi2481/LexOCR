"""Inicialización y ejecución de PaddleOCR."""

from typing import Any

from PIL import Image

from .parsing import _parse_paddle_raw
from .schemas import InferOptions
from .storage import UPLOAD_DIR

_DEVICE_INFO: dict[str, Any] = {"cuda_compiled": False, "device": "cpu"}
_ocr_engine: Any | None = None
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


def get_ocr():
    """Lazy-init PaddleOCR PP-OCRv6 medium (motor fijo v1)."""
    global _ocr_engine
    if _ocr_engine is not None:
        return _ocr_engine
    from paddleocr import PaddleOCR
    if not _DEVICE_INFO.get("device"):
        _refresh_device_info()
    kwargs: dict[str, Any] = {
        "ocr_version": "PP-OCRv6",
        "use_doc_orientation_classify": False,
        "use_doc_unwarping": False,
        # Nombre 3.x del obsoleto use_angle_cls; solo clasifica 0/180.
        "use_textline_orientation": True,
        "text_detection_model_name": f"PP-OCRv6_{OCR_TIER}_det",
        "text_recognition_model_name": f"PP-OCRv6_{OCR_TIER}_rec",
        "device": _DEVICE_INFO["device"],
        # oneDNN/mkldnn rompe predict en algunos builds Windows (PIR Unimplemented)
        "enable_mkldnn": False,
    }
    engine = None
    drop_order = (
        "enable_mkldnn", "device", "text_detection_model_name",
        "text_recognition_model_name", "ocr_version",
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
    _ocr_engine = engine
    return engine


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


def _run_paddle(
    path: str,
    options: InferOptions | None = None,
) -> tuple[list[tuple[list, tuple[str, float]]], list[int]]:
    engine = get_ocr()
    raw = _call_predict(engine, path, options)
    return _parse_paddle_raw(raw)
