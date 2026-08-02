# Paquete `app`

## Qué hace

Orquesta PP-OCRv6 medium: carga de motors (escena / documento), predict multipágina, parsing y rescate de texto vertical/diagonal.

## Módulos

- `main.py` — entorno PaddleX, lifespan, CORS, FastAPI
- `routes.py` — endpoints HTTP; upload documento → N páginas
- `schemas.py` — Pydantic (`InferOptions`, `OCRResult` con `page_index` / `page_count`)
- `storage.py` — formatos (imagen + PDF/TIFF), PNG, tope `MAX_PAGES=50`
- `ocr.py` — device, `get_ocr` / `get_ocr_document`, predict, preview de página
- `parsing.py` — normaliza salida Paddle → `OCRResult`
- `orientation.py` — segundo pase vertical/diagonal

## Engines

- **Escena** (`get_ocr`): sin orientation/unwarping de página.
- **Documento** (`get_ocr_document`): `use_doc_orientation_classify` + `use_doc_unwarping` ON.
- Preview de página: imagen del Result Paddle / `save_to_img`; TIFF fallback Pillow si `predict` no pagina.

## Orientación y rescate

Paddle solo clasifica línea 0°/180° y endereza crops muy altos. El rescate estima ángulo en el crop (`minAreaRect`), barre ±7.5/15 (y fallback de grilla) y reemplaza el texto solo si mejora la confianza (margen 0.02 en diagonales). Se aplica también a cada página materializada de PDF/TIFF.

## Qué no hace

No expone selectores tiny/small ni HPI; no usa Official API cloud; no rasteriza PDF con libs de terceros.

## Archivos relacionados

- [../README.md](../README.md)
- [../../docs/PRODUCT.md](../../docs/PRODUCT.md)
