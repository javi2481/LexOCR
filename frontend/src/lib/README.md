# Librerías

## Qué hace

Cliente HTTP, geometría de resultados, orden de lectura y serialización de export para LLM.

## Módulos

- `api.ts` — upload / infer / batch / health / annotated download; `DEFAULT_INFER_OPTIONS`
- `exportResult.ts` — JSON (con `reading_order`), Markdown, CSV, TXT
- `readingOrder.ts` — orden espacial de regiones
- `resultLayout.ts` — layout SVG de ResultText
- `files.ts` — tipos de archivo aceptados / preview

## Qué no hace

No renderiza UI; no ejecuta OCR.

## Archivos relacionados

- [../types/README.md](../types/README.md)
- [../../../docs/examples/ocr-result.example.json](../../../docs/examples/ocr-result.example.json)
