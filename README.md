# IDP OCR Studio (MVP low-code)

SPA académica para OCR con **PP-OCRv6 medium**: subir imágenes, inferir, ver bounding boxes / ResultText espacial, editar texto y exportar (JSON / MD / CSV / TXT + PNG anotado).

## Mapa del repo

| Ruta | Rol |
|------|-----|
| [backend/](backend/README.md) | API FastAPI + PaddleOCR |
| [backend/app/](backend/app/README.md) | Módulos: ocr, orientation, routes… |
| [frontend/](frontend/README.md) | UI React + Vite |
| [frontend/src/](frontend/src/README.md) | Componentes y libs |
| [tests/fixtures/images/](tests/fixtures/images/README.md) | Imágenes de prueba |
| [docs/](docs/README.md) | Producto, ejemplos, archivo |
| [scripts/](scripts/) | Arranque dev |
| [CHANGELOG.md](CHANGELOG.md) | Estado reciente |

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

Manual:

```powershell
# terminal 1
cd backend; .\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8100
# terminal 2
cd frontend; npm run dev
```

Variables: [`.env.example`](.env.example) (`VITE_API_URL`, `PADDLE_PDX_CACHE_HOME`).

## Producto (resumen)

- Tier **medium** fijo (sin selector).
- Formatos: PNG, JPEG, WEBP, GIF, BMP, TIFF, ICO, PPM, AVIF. **Sin PDF**.
- Rescate angular por región (verticales + diagonales); `orientation` en grados.
- Export: JSON (con `reading_order`), Markdown, CSV, TXT, PNG anotado.
- Detalle: [docs/PRODUCT.md](docs/PRODUCT.md). Ejemplo JSON: [docs/examples/ocr-result.example.json](docs/examples/ocr-result.example.json).

## Checklist e2e manual

Con backend y frontend arriba, subí y corré **Run** (medium):

| Fixture | Esperado |
|---------|----------|
| `tests/fixtures/images/poster.avif` | `TRY` ≈ −90°, `WERE` ≈ +90° |
| `tests/fixtures/images/nube-manzana.png` | confAvg razonable; algunas regiones con orientation ≠ 0 |
| `tests/fixtures/images/nube-corazon.jpeg` | ídem |
| Export **md** / **json** | Descargables y legibles |

También: `cd frontend && npm run build`.

## Continuidad (no es runtime)

- `engram-export.json` / `.engram/` — memorias entre PCs (`engram import` / `sync`).
- `.cursor/` — skills y agents del flujo de desarrollo.

## Stack

- Frontend: React 19 + TypeScript + Vite + Tailwind CSS v4  
- Backend: FastAPI + PaddleOCR PP-OCRv6 (`backend/app/`)
