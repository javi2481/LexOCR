# LexOCR — backend

## Qué hace

API FastAPI: subir imágenes o PDF/TIFF, ejecutar PP-OCRv6 medium (engine escena + rescate angular en imágenes) y devolver / exportar resultados listos para revisión y consumo LLM.

## Entrada / salida

- **Entrada:** archivo ≤ 20 MB.
  - Imágenes: PNG, JPEG, WEBP, GIF, BMP, ICO, PPM, AVIF → PNG normalizado + infer bajo demanda.
  - Documentos: **PDF** (`pypdfium2`) / **TIFF** (Pillow) → rasteriza a PNG por página (tope 50); OCR vía `/infer` (progreso por página en UI).
- **Salida:** `OCRResult` JSON (regiones, confianza, `orientation`, `page_index`/`page_count` si aplica, `ocr_tier: medium`) o PNG anotado.

## Ejecución

Desde `backend/`:

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --host 0.0.0.0 --port 8100
```

- API: `http://127.0.0.1:8100`
- OpenAPI: `/docs`

## Endpoints

- `GET /health` — device y engines cacheados (escena)
- `POST /upload` — imagen → 1 `image_id` pending; PDF/TIFF → rasteriza páginas y `pages[]` pending
- `POST /infer/{image_id}` — OCR escena; rescue ON solo si no es página PDF/TIFF
- `POST /infer/batch` — lista de ids
- `GET /image/{image_id}` — PNG de preview
- `GET /status/{image_id}`
- `GET /export/{image_id}/annotated` — PNG con boxes desde el OCRResult guardado (sin re-OCR)

## Engine

| | Escena (único) |
|--|----------------|
| Modelo | PP-OCRv6 medium |
| `use_textline_orientation` | True |
| `use_doc_orientation_classify` | False |
| `use_doc_unwarping` | False (UVDoc OFF; demasiado lento en CPU) |

PDF/TIFF no usan un segundo engine: se rasterizan y se OCR-ean como PNG.

## Entorno

- `PADDLE_PDX_CACHE_HOME=backend/.paddlex` (por defecto en app)
- `PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True` (seteado en código al arrancar)
- `PADDLEOCR_API_TOKEN` — opcional, solo SDK cloud futuro (no leído por este API)
- Uploads en `backend/uploads/` (store in-memory; se pierde al reiniciar)

## Qué no hace

StructureV3/VL/HPD, HPI, multi-motor, auth, DB, colas, Docker, Poppler/pdf2image.

## Archivos relacionados

- [app/README.md](app/README.md) — módulos internos
- [../docs/PRODUCT.md](../docs/PRODUCT.md)
