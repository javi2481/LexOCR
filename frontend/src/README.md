# Código fuente (`frontend/src`)

## Qué hace

Compone el studio OCR y orquesta sesión, layout espacial y export.

## Mapa

- `App.tsx` — composición de layout (tema, zoom, viewMode, wire de props)
- `hooks/useStudioSession.ts` — estado de imágenes, upload, infer, batch, edición
- `components/` — zonas presentacionales del studio
- `lib/` — API, geometría, reading order, export
- `types/` — contratos TypeScript

## Qué no hace

La lógica de OCR vive en el backend; aquí solo cliente HTTP y UI.

## Archivos relacionados

- [components/README.md](components/README.md)
- [lib/README.md](lib/README.md)
- [types/README.md](types/README.md)
