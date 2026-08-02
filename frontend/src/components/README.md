# Componentes

## Qué hace

Presentación del studio OCR. Reciben estado y callbacks por props; no llaman a la API ni guardan sesión global.

## Zonas

- `Header` — Run / Run All / Clear, exports, tema, métricas
- `Gallery` — miniaturas y dropzone
- `ImageViewer` — imagen + boxes
- `ResultText` — texto espacial SVG (poly + orientación)
- `WordsTray` — lista editable de regiones
- `StatusFooter` — progreso / health

## Qué no hace

Inferencia, parsing OCR, serialización de export (eso está en `hooks/` y `lib/`).

## Archivos relacionados

- [../hooks/useStudioSession.ts](../hooks/useStudioSession.ts)
- [../README.md](../README.md)
