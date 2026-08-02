# Documentación

## Índice

| Doc | Contenido |
|-----|-----------|
| [PRODUCT.md](PRODUCT.md) | Misión y alcance: imagen/PDF/TIFF → OCR → formatos LLM |
| [examples/ocr-result.example.json](examples/ocr-result.example.json) | Forma del JSON de export (LLM-ready; campos de página opcionales) |

## READMEs de capacidad

- [../README.md](../README.md) — entrada al proyecto (Apache-2.0)
- [../backend/README.md](../backend/README.md) — API FastAPI
- [../backend/app/README.md](../backend/app/README.md) — módulos OCR (escena / documento)
- [../frontend/README.md](../frontend/README.md) — UI
- [../frontend/src/README.md](../frontend/src/README.md) — mapa de `src/`
- [../frontend/src/components/README.md](../frontend/src/components/README.md) — componentes del studio
- [../frontend/src/lib/README.md](../frontend/src/lib/README.md) — cliente API y export
- [../frontend/src/types/README.md](../frontend/src/types/README.md) — contratos TypeScript
- [../tests/fixtures/images/README.md](../tests/fixtures/images/README.md) — imágenes de prueba

## Notas

- Multipágina: nativo PP-OCRv6; sin libs PDF de terceros.
- Token cloud (`PADDLEOCR_API_TOKEN` en `.env`) es opcional/futuro; el studio local no lo usa.
