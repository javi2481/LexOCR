# LexOCR

SPA académica para **extraer texto de imágenes y documentos (PDF/TIFF)** y exportarlo a formatos **consumibles por un LLM** (JSON / Markdown / CSV / TXT + PNG anotado).

**v1** usa OCR clásico (**PP-OCRv6 medium**): las páginas de PDF/TIFF se rasterizan y se OCR-ean una a una. **v2** usará un **VLM**. Detalle: [docs/PRODUCT.md](docs/PRODUCT.md).

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

Variables: [`.env.example`](.env.example) (`VITE_API_URL`, cache PaddleX; opcional `PADDLEOCR_API_TOKEN` para SDK cloud futuro — el pipeline local no lo usa).

### Probar en 2 minutos

1. Arrancá con `.\scripts\dev.ps1` y abrí http://localhost:5173  
2. Subí `tests/fixtures/images/poster.avif` → **Run** → revisá `TRY` / `WERE` verticales  
3. (Opcional) Subí un PDF corto (2–3 págs.): la UI rasteriza, auto-OCR página a página y arma la galería  
4. Exportá **json** o **md** desde el header  

## Producto (resumen)

- Motor único **PP-OCRv6 medium** (engine escena; sin `doc_orientation` / unwarping).
- **Imágenes:** PNG, JPEG, WEBP, GIF, BMP, ICO, PPM, AVIF → PNG pending → **Run** / `/infer` (rescate angular ON).
- **Documentos:** PDF (raster `pypdfium2`) y TIFF (Pillow); tope **50** págs. / ≤ **20 MB** → N PNG pending → la UI auto-llama `/infer` por página (rescate OFF en PDF/TIFF).
- Export JSON (`reading_order`, `page_index`), Markdown, CSV, TXT, PNG anotado.
- Ejemplo JSON: [docs/examples/ocr-result.example.json](docs/examples/ocr-result.example.json).

## Checklist e2e manual

Con backend y frontend arriba:

| Caso | Cómo / esperado |
|------|-----------------|
| `tests/fixtures/images/poster.avif` | **Run** → `TRY` ≈ −90°, `WERE` ≈ +90° |
| `nube-manzana.png` / `nube-corazon.jpeg` | confAvg razonable; algunas `orientation ≠ 0` |
| PDF corto (2–3 págs.) | Galería `doc.pdf · p.k/n`; UI auto-OCR; API deja páginas `pending` tras `/upload` |
| TIFF multipágina | Ídem (frames vía Pillow) |
| PDF > 50 págs. | HTTP 400 |
| Export **md** / **json** | Incluyen `page_index` / `page_count` en páginas de documento |

También: `cd frontend && npm run build`.

## Stack

- Frontend: React 19 + TypeScript + Vite + Tailwind CSS v4  
- Backend: FastAPI + PaddleOCR PP-OCRv6 (`backend/app/`)
