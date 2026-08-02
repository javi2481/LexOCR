# IDP OCR Studio — backend

## Qué hace

API FastAPI: subir imágenes, ejecutar PP-OCRv6 medium (con rescate angular) y devolver / exportar resultados listos para revisión y consumo LLM.

## Entrada / salida

- **Entrada:** imagen ≤ 20 MB (PNG, JPEG, WEBP, GIF, BMP, TIFF, ICO, PPM, AVIF).
- **Salida:** `OCRResult` JSON (regiones, confianza, `orientation`, metadato `ocr_tier: medium`) o PNG anotado.

## Ejecución

Desde `backend/`:

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --host 0.0.0.0 --port 8100
```

- API: `http://127.0.0.1:8100`
- OpenAPI: `/docs`

## Endpoints

- `GET /health` — device y motor cargado
- `POST /upload` — normaliza a PNG
- `GET /image/{image_id}` — PNG normalizado
- `POST /infer/{image_id}` — OCR
- `POST /infer/batch` — lista de ids
- `GET /status/{image_id}`
- `GET /export/{image_id}/annotated` — PNG con boxes (`save_to_img`)

## Entorno

- `PADDLE_PDX_CACHE_HOME=backend/.paddlex` (por defecto en app)
- `PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True`
- Uploads en `backend/uploads/` (store in-memory; se pierde al reiniciar)

## Qué no hace

PDF, multi-motor, auth, DB, colas, Docker.

## Archivos relacionados

- [app/README.md](app/README.md) — módulos internos
- [../docs/PRODUCT.md](../docs/PRODUCT.md)
