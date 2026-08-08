# Componentes

## Qué hace

Presentación del studio OCR. Reciben estado y callbacks por props; no llaman a la API ni guardan sesión global.

## Zonas

- `Header` — Run / Run All / Clear, exports, tema, métricas y etapas de busy
- `StudioSubbar` — toggle vista página / documento
- `Gallery` — miniaturas y dropzone (páginas PDF/TIFF como ítems)
- `ImageViewer` — imagen + boxes (pan/zoom)
- `ResultText` — texto espacial SVG (poly + orientación)
- `DocumentView` — vista consolidada multipágina
- `WordsTray` — lista editable de regiones
- `StatusFooter` — progreso / health

## Qué no hace

Inferencia, parsing OCR, serialización de export (eso está en `hooks/` y `lib/`).

## Archivos relacionados

- [../hooks/useStudioSession.ts](../hooks/useStudioSession.ts)
- [../hooks/usePanZoom.ts](../hooks/usePanZoom.ts)
- [../README.md](../README.md)
