# Changelog

## 2026-08-08 — Docs alineadas + limpieza de basura

- Documentación (README, PRODUCT, mapas backend/frontend, fixtures) describe el pipeline real: raster PDF/TIFF + `/infer` por página.
- Eliminado código muerto de “predict nativo multipágina” en `backend/app/ocr.py`.
- `pypdfium2` declarado en `requirements.txt`; `.env.example` aclara cache PaddleX vs token cloud.

## 2026-08-07 — UX studio + PNG anotado sin re-OCR

- Header: progreso por etapas (Preparar → Cargar → OCR), métricas destacadas al completar.
- Pan/zoom con rueda y arrastre en Input Image y Texto para LLM (`usePanZoom`).
- Export PNG anotado desde el `OCRResult` guardado (Pillow), sin volver a correr Paddle.
- Feedback de carga en el botón PNG; limpieza de mockups `mejora_frontend/` y PDFs locales de `datos_prueba/`.

## 2026-08-02 — PDF/TIFF multipágina (raster + infer)

> Nota: la implementación real rasteriza con `pypdfium2`/Pillow y OCR via `/infer` por página (engine escena). No hay predict nativo multipágina ni engine documento con doc_ori/unwarping.

- Upload acepta PDF y TIFF; N páginas → N `image_id` + PNG pending; tope 50.
- Frontend: accept `.pdf`, galería expandida `pages[]` (`page_index` / `page_count`), auto-OCR en UI.
- Token Official API (cloud) solo en `.env` local; HPI / SDK cloud fuera de este corte.

## 2026-08-02 — Higiene meta OCR → LLM

- Repo alineado a la misión: imagen → OCR clásico → formatos para LLM; v2 = VLM.
- Eliminado ruido: `docs/archive/`, `.cursor/`, `.engram/`, `engram-export.json`.
- Motor fijo medium: sin selectores `mode`/`tier` en API ni UI; metadato `ocr_tier: medium` en export.
- Documentación y READMEs de capacidad reescritos; licencia **Apache-2.0**.
- `.gitignore`: tooling local (`.cursor/`, Engram).

## 2026-07-30 — v1 cerrada

- **v1 freeze**: fin de iteración del pipeline clásico PP-OCRv6. **v2 usará VLM** (ver [docs/PRODUCT.md](docs/PRODUCT.md)).
- App slim: orquestación en `useStudioSession`, `readingOrder`, `StatusFooter`.
- Rescate diagonal P0: ángulo del texto dentro del crop (`minAreaRect` + barrido ±7.5/15), margen 0.02 en diagonales; fallback grid si no hay semilla. Ya usamos `dt_polys` (sin APIs 2.x `det_db_*`).
- Smoke medium (post-refine): poster `TRY`/`WERE` ±90 OK; nubes manzana/corazón confAvg 0.945/0.894 y 28/38 con `orientation ≠ 0` (antes ~7/21).
- Soporte AVIF (backend + frontend).
- ResultText espacial SVG (poly + orientación).
- Rescate angular por región: ±90, barrido ±30/45/60 y 180; `orientation` float.
- Tier de producto fijo en **medium** (sin selector en UI).
- Export JSON enriquecido (`reading_order`, `orientation`), Markdown, CSV y TXT.
- Higiene del repo: `backend/app/*`, componentes frontend, fixtures en `tests/fixtures/images/`, docs por capacidad.

## Anterior

- Cotejo PaddleOCR 3.x (text_det_*, warmup, `/health` device, PNG anotado, Run All).
- PP-OCRv6 unificado; export anotado `save_to_img`.
