# Changelog

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
