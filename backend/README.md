# IDP OCR Studio — backend

## Qué hace

API FastAPI: subir imágenes o PDF/TIFF, ejecutar PP-OCRv6 medium (escena o documento + rescate angular) y devolver / exportar resultados listos para revisión y consumo LLM.

## Entrada / salida

- **Entrada:** archivo ≤ 20 MB.
  - Imágenes: PNG, JPEG, WEBP, GIF, BMP, ICO, PPM, AVIF → PNG normalizado + infer bajo demanda.
  - Documentos: **PDF** / **TIFF** → `predict` multipágina (tope 50); respuesta `pages[]` con OCR + preview por página.
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

- `GET /health` — device y engines cacheados (escena y/o documento)
- `POST /upload` — imagen → 1 `image_id`; PDF/TIFF → OCR documento + `pages[]`
- `GET /image/{image_id}` — PNG de preview (página materializada)
- `POST /infer/{image_id}` — re-OCR escena + rescue sobre PNG
- `POST /infer/batch` — lista de ids (omite el origen documento crudo)
- `GET /status/{image_id}`
- `GET /export/{image_id}/annotated` — PNG con boxes (`save_to_img`)

## Engines

| | Escena | Documento (PDF/TIFF) |
|--|--------|----------------------|
| Modelo | PP-OCRv6 medium | PP-OCRv6 medium |
| `use_textline_orientation` | True | True |
| `use_doc_orientation_classify` | False | True |
| `use_doc_unwarping` | False | True |

## Entorno

- `PADDLE_PDX_CACHE_HOME=backend/.paddlex` (por defecto en app)
- `PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True`
- `PADDLEOCR_API_TOKEN` — opcional, solo SDK cloud futuro (no leído por este API)
- Uploads en `backend/uploads/` (store in-memory; se pierde al reiniciar)

## Qué no hace

Libs PDF ajenas, StructureV3/VL/HPD, HPI, multi-motor, auth, DB, colas, Docker.

## Archivos relacionados

- [app/README.md](app/README.md) — módulos internos
- [../docs/PRODUCT.md](../docs/PRODUCT.md)
