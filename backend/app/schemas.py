"""Modelos de entrada y salida de la API."""

from pydantic import BaseModel, Field


class InferOptions(BaseModel):
    # Solo UI/métricas (low_confidence_count, colores). No corta el motor.
    conf_threshold: float = Field(default=0.9, ge=0.5, le=0.99)
    # Defaults recall-first (scene/display). None omite el param → default Paddle.
    text_det_box_thresh: float | None = 0.35
    text_det_thresh: float | None = 0.20
    text_det_unclip_ratio: float | None = 2.0
    text_det_limit_side_len: int | None = 1152
    text_det_limit_type: str | None = "min"


class Region(BaseModel):
    id: int
    text: str
    confidence: float
    bbox: dict[str, float]
    poly: list[list[float]] = Field(default_factory=list)
    # Grados SVG (eje y hacia abajo); 0 = texto horizontal.
    orientation: float = 0.0


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
    # Motor fijo v1 (metadato de export / LLM).
    ocr_mode: str = "fast"
    ocr_tier: str = "medium"
    conf_threshold: float = 0.9
    # Multipágina (PDF/TIFF); None en imágenes de escena.
    page_index: int | None = None
    page_count: int | None = None
    source_format: str | None = None


class BatchRequest(InferOptions):
    image_ids: list[str] = Field(default_factory=list)
