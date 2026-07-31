# Changelog

## 2026-07-30

- Soporte AVIF (backend + frontend).
- ResultText espacial SVG (poly + orientación).
- Rescate angular por región: ±90, barrido ±30/45/60 y 180; `orientation` float.
- Tier de producto fijo en **medium** (sin selector en UI).
- Export JSON enriquecido (`reading_order`, `orientation`), Markdown, CSV y TXT.
- Higiene del repo: `backend/app/*`, componentes frontend, fixtures en `tests/fixtures/images/`, docs por capacidad.

## Anterior

- Cotejo PaddleOCR 3.x (text_det_*, warmup, `/health` device, PNG anotado, Run All).
- PP-OCRv6 unificado; export anotado `save_to_img`.
