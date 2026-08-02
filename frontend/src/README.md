# Código fuente (`frontend/src`)

## Qué hace

Compone el studio OCR y orquesta sesión (incl. expansión de `pages[]` de PDF/TIFF), layout espacial y export.

## Mapa

- `App.tsx` — composición de layout (tema, zoom, viewMode, accept `.pdf`)
- `hooks/useStudioSession.ts` — estado, upload, expansión multipágina, infer, batch, edición
- `components/` — zonas presentacionales del studio
- `lib/` — API, geometría, reading order, export, tipos de archivo
- `types/` — contratos TypeScript (`UploadPage`, `page_index`, …)

## Qué no hace

La lógica de OCR vive en el backend; aquí solo cliente HTTP y UI.

## Archivos relacionados

- [components/README.md](components/README.md)
- [lib/README.md](lib/README.md)
- [types/README.md](types/README.md)
