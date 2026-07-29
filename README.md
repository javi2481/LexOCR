# IDP OCR Studio (MVP low-code)

SPA académica para OCR con **PaddleOCR**: subir imágenes, inferir, ver bounding boxes y editar texto.

## Requisitos

- Python 3.11+
- Node.js 20+

## Backend

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

La primera ejecución descarga modelos de PaddleOCR (puede tardar).

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Abrir http://localhost:5173

## Formatos soportados

- Imágenes: PNG, JPG/JPEG/JFIF, WEBP, GIF, BMP, TIFF, ICO, PPM
- Documentos: PDF (solo la primera página; se convierte a PNG)

## Uso

1. Arrastrar imágenes o PDF a la galería
2. Click **Run** o **Run All**
3. Revisar BB en el visor y editar texto a la derecha
4. Exportar JSON / CSV / TXT (usa el texto editado)

## Stack

- Frontend: React 19 + TypeScript + Vite + Tailwind CSS v4
- Backend: FastAPI + PaddleOCR (un solo `main.py`)
