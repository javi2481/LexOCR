# IDP OCR Studio

SPA académica para **extraer texto de imágenes** y exportarlo a formatos **consumibles por un LLM** (JSON / Markdown / CSV / TXT + PNG anotado).

**v1** usa OCR clásico (**PP-OCRv6 medium**). **v2** usará un **VLM**. Detalle: [docs/PRODUCT.md](docs/PRODUCT.md).

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

Variables: [`.env.example`](.env.example) (`VITE_API_URL`, `PADDLE_PDX_CACHE_HOME`).

## Producto (resumen)

- Motor **PP-OCRv6 medium** fijo.
- Formatos de imagen: PNG, JPEG, WEBP, GIF, BMP, TIFF, ICO, PPM, AVIF. **Sin PDF**.
- Rescate angular por región; export JSON (`reading_order`), Markdown, CSV, TXT, PNG anotado.
- Ejemplo JSON: [docs/examples/ocr-result.example.json](docs/examples/ocr-result.example.json).

## Checklist e2e manual

Con backend y frontend arriba, subí y corré **Run** (medium):

| Fixture | Esperado |
|---------|----------|
| `tests/fixtures/images/poster.avif` | `TRY` ≈ −90°, `WERE` ≈ +90° |
| `tests/fixtures/images/nube-manzana.png` | confAvg razonable; algunas regiones con orientation ≠ 0 |
| `tests/fixtures/images/nube-corazon.jpeg` | ídem |
| Export **md** / **json** | Descargables y legibles |

También: `cd frontend && npm run build`.

## Stack

- Frontend: React 19 + TypeScript + Vite + Tailwind CSS v4  
- Backend: FastAPI + PaddleOCR PP-OCRv6 (`backend/app/`)
