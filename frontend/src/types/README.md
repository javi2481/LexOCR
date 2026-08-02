# Tipos

## Qué hace

Contratos TypeScript compartidos: `InferOptions`, `OCRResult`, `Region`, `UploadResponse` / `UploadPage`, ítems de galería, health.

## Decisiones clave

- Sin union `tiny|small|medium` ni mode `document` en UI: el motor es medium fijo; el backend elige engine escena vs documento según formato.
- `ocr_tier` / `ocr_mode` en el resultado son metadatos de export (strings).
- `page_index` / `page_count` / `source_format` opcionales (páginas de PDF/TIFF).
- `conf_threshold` solo alimenta métricas / colores UI; no corta el motor.

## Archivos relacionados

- [ocr.ts](ocr.ts)
- [../lib/api.ts](../lib/api.ts)
