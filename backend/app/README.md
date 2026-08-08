# Paquete `app`

## Qué hace

Orquesta PP-OCRv6 medium: carga del engine escena, predict por imagen/página, parsing, rescate de texto vertical/diagonal (imágenes) y PNG anotado sin re-OCR.

## Módulos

- `main.py` — entorno PaddleX, lifespan, CORS, FastAPI
- `routes.py` — endpoints HTTP; upload documento → N páginas pending (OCR vía `/infer`)
- `schemas.py` — Pydantic (`InferOptions`, `OCRResult` con `page_index` / `page_count`)
- `storage.py` — formatos (imagen + PDF/TIFF), PNG, raster PDF (`pypdfium2`) / TIFF (Pillow), tope `MAX_PAGES=50`
- `ocr.py` — device, `get_ocr` / `get_recognizer`, predict escena, warmup
- `parsing.py` — normaliza salida Paddle → `OCRResult`
- `orientation.py` — segundo pase vertical/diagonal (rescue)
- `annotate.py` — dibuja boxes/texto sobre el PNG desde el `OCRResult` guardado

## Engine

Un solo engine escena (`get_ocr`): `use_doc_orientation_classify=False`, `use_doc_unwarping=False`, `use_textline_orientation=True`.

PDF/TIFF: raster en `storage.py` → cada página es un PNG que pasa por el mismo `/infer`.

## Orientación y rescate

Paddle solo clasifica línea 0°/180° y endereza crops muy altos. El rescate estima ángulo en el crop (`minAreaRect`), barre ±7.5/15 (y fallback de grilla) y reemplaza el texto solo si mejora la confianza (margen 0.02 en diagonales).

Se aplica **solo a imágenes** (no a páginas cuyo `source_format` es pdf/tiff), por coste CPU.

## Qué no hace

No expone selectores tiny/small ni HPI; no usa Official API cloud; no hace predict nativo multipágina Paddle sobre el PDF crudo.

## Archivos relacionados

- [../README.md](../README.md)
- [../../docs/PRODUCT.md](../../docs/PRODUCT.md)
