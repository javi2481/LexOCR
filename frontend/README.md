# LexOCR — frontend

## Qué hace

Studio web: galería (incluye páginas de PDF/TIFF), visor con boxes, ResultText espacial, edición de palabras y export a formatos LLM-ready.

## Entrada / salida

- **Entrada:** imágenes y **PDF** / TIFF (upload API). Un documento se expande a N ítems en la galería; la UI auto-dispara `/infer` por página.
- **Salida:** UI + descargas JSON / MD / CSV / TXT / PNG anotado (`page_index` en export de páginas; export documento consolidado).

## Desarrollo

```bash
npm install
npm run dev
```

Backend por defecto: `http://localhost:8100`. Override:

```powershell
$env:VITE_API_URL="http://localhost:8100"
npm run dev
```

## Build

```bash
npm run build
```

## Qué no hace

No ejecuta OCR en el browser; no selecciona tier/mode (motor fixed medium en API).

## Archivos relacionados

- [src/README.md](src/README.md)
- [../docs/PRODUCT.md](../docs/PRODUCT.md)
