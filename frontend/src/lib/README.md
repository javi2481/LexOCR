# Librerías

## Qué hace

Cliente HTTP, geometría de resultados, orden de lectura, etapas de pipeline UI y serialización de export (página o documento) para LLM.

## Módulos

- `api.ts` — upload / infer / batch / health / annotated download; `DEFAULT_INFER_OPTIONS`
- `pipeline.ts` — etapas de busy del header (Preparar → Cargar → OCR)
- `exportResult.ts` — JSON (con `reading_order`), Markdown (`page_index` si aplica), CSV, TXT (una página)
- `exportDocument.ts` — export consolidado multipágina
- `consolidate.ts` — une resultados de páginas de un documento
- `documentGroups.ts` — agrupa ítems de galería por documento origen
- `readingOrder.ts` — orden espacial de regiones
- `resultLayout.ts` — layout SVG de ResultText
- `files.ts` — accept (incl. `.pdf`), preview servidor, `isDocumentFile`

## Qué no hace

No renderiza UI; no ejecuta OCR.

## Archivos relacionados

- [../types/README.md](../types/README.md)
- [../../../docs/examples/ocr-result.example.json](../../../docs/examples/ocr-result.example.json)
