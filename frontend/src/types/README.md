# Tipos

## Qué hace

Contratos TypeScript compartidos: `InferOptions`, `OCRResult`, `Region`, ítems de galería, health.

## Decisiones clave

- Sin union `tiny|small|medium` ni mode `document`: el motor es medium fijo en backend.
- `ocr_tier` / `ocr_mode` en el resultado son metadatos de export (strings).
- `conf_threshold` solo alimenta métricas / colores UI; no corta el motor.

## Archivos relacionados

- [ocr.ts](ocr.ts)
- [../lib/api.ts](../lib/api.ts)
