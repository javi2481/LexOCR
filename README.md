# IDP OCR Studio

SPA académica para **extraer texto de imágenes y documentos (PDF/TIFF)** y exportarlo a formatos **consumibles por un LLM** (JSON / Markdown / CSV / TXT + PNG anotado).

**v1** usa OCR clásico (**PP-OCRv6 medium**), con pipeline nativo multipágina para PDF/TIFF. **v2** usará un **VLM**. Detalle: [docs/PRODUCT.md](docs/PRODUCT.md).

**License:** [Apache License 2.0](LICENSE)

## Mapa del repo

| Ruta | Rol |
|------|-----|
| [backend/](backend/README.md) | API FastAPI + PaddleOCR |
| [backend/app/](backend/app/README.md) | Módulos: ocr, orientation, routes… |
| [frontend/](frontend/README.md) | UI React + Vite |
| [frontend/src/](frontend/src/README.md) | Componentes y libs |
| [tests/fixtures/images/](tests/fixtures/images/README.md) | Imágenes de prueba |
| [docs/](docs/README.md) | Producto y ejemplos |
| [scripts/](scripts/) | Arranque dev |
| [CHANGELOG.md](CHANGELOG.md) | Cambios recientes |
| [LICENSE](LICENSE) | Apache-2.0 |

## Requisitos

- Python 3.11+
- Node.js 20+

## Quickstart

### Bootstrap (una vez)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

cd ..\frontend
npm install
```

### Arranque

```powershell
# Desde la raíz del repo
.\scripts\dev.ps1
```

Unix:

```bash
./scripts/dev.sh
```

- Frontend: http://localhost:5173  
- API: http://localhost:8100 (`/health`, `/docs`)

Variables: [`.env.example`](.env.example) (`VITE_API_URL`, `PADDLE_PDX_CACHE_HOME`, opcional `PADDLEOCR_API_TOKEN` para SDK cloud futuro — el pipeline local no lo usa).

## Producto (resumen)

- Motor **PP-OCRv6 medium** fijo.
- **Imágenes:** PNG, JPEG, WEBP, GIF, BMP, ICO, PPM, AVIF (engine escena).
- **Documentos:** PDF y TIFF multipágina vía `PaddleOCR.predict` nativo (engine documento: orientation + unwarping; tope **50** págs.; sin Poppler/`pypdfium2`).
- Rescate angular por región; export JSON (`reading_order`, `page_index`), Markdown, CSV, TXT, PNG anotado.
- Ejemplo JSON: [docs/examples/ocr-result.example.json](docs/examples/ocr-result.example.json).

## Checklist e2e manual

Con backend y frontend arriba:

| Caso | Cómo / esperado |
|------|-----------------|
| `tests/fixtures/images/poster.avif` | **Run** → `TRY` ≈ −90°, `WERE` ≈ +90° |
| `nube-manzana.png` / `nube-corazon.jpeg` | confAvg razonable; algunas `orientation ≠ 0` |
| PDF corto (2–3 págs.) | Al subir: galería con N ítems `doc.pdf · p.k/n`, OCR ya hecho |
| TIFF multipágina | Ídem; si Paddle no pagina, fallback Pillow por frame |
| PDF > 50 págs. | HTTP 400 |
| Export **md** / **json** | Incluyen `page_index` / `page_count` en páginas de documento |

También: `cd frontend && npm run build`.

## Stack

- Frontend: React 19 + TypeScript + Vite + Tailwind CSS v4  
- Backend: FastAPI + PaddleOCR PP-OCRv6 (`backend/app/`)
