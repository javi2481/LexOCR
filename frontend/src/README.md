# Código fuente (`frontend/src`)

## Qué hace

Compone el studio OCR y orquesta sesión (incl. expansión de `pages[]` de PDF/TIFF y auto-OCR de documentos), layout espacial, vistas página/documento y export.

## Mapa

- `App.tsx` — composición de layout (tema, zoom, viewMode página/documento, accept `.pdf`)
- `hooks/useStudioSession.ts` — estado, upload, expansión multipágina, auto-infer de docs, batch, edición
- `hooks/usePanZoom.ts` — pan/zoom compartido (rueda + arrastre) para Input Image y ResultText
- `components/` — zonas presentacionales del studio
- `lib/` — API, geometría, reading order, pipeline de busy, consolidate/export documento
- `types/` — contratos TypeScript (`UploadPage`, `page_index`, …)

## Qué no hace

La lógica de OCR vive en el backend; aquí solo cliente HTTP y UI.

## Archivos relacionados

- [components/README.md](components/README.md)
- [lib/README.md](lib/README.md)
- [types/README.md](types/README.md)
