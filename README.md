# IDP OCR Studio (MVP low-code)

SPA académica para OCR con **PP-OCRv6**: subir imágenes, inferir, ver bounding boxes/polígonos y editar texto.

## Requisitos

- Python 3.11+
- Node.js 20+

## Backend

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8100
```

La primera ejecución descarga modelos de PaddleOCR (puede tardar). Al arrancar el servidor se hace warmup del engine default (`fast`×`medium`). Cada combinación modo×tier se cachea al usarla por primera vez.

Variables de entorno de ejemplo: ver [`.env.example`](.env.example) (`VITE_API_URL`, `PADDLE_PDX_CACHE_HOME`).

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Abrir http://localhost:5173 (API por defecto: `http://localhost:8100`).

## Formatos soportados

Solo imágenes: PNG, JPG/JPEG/JFIF, WEBP, GIF, BMP, TIFF, ICO, PPM/PNM, AVIF.

PDF no está soportado.

## Opciones OCR

En el header (nombres alineados a PaddleOCR 3.x):

| Control | Valores | Efecto |
|---------|---------|--------|
| Modo | Rápido / Documento | Documento activa `use_doc_orientation_classify`; `use_textline_orientation` siempre on |
| Tier | tiny / small / medium | Velocidad vs precisión (PP-OCRv6 unificado, ~50 idiomas) |
| Conf | 50–95% | `text_rec_score_thresh` en `predict()` + métrica de baja confianza |
| Det thresh | auto / 0.1–0.9 | `text_det_thresh` (default motor 0.3) |
| Box thresh | auto / 0.1–0.9 | `text_det_box_thresh` (default motor 0.6) |
| Unclip | auto / 1.0–3.0 | `text_det_unclip_ratio` (default motor ~2.0) |

Las opciones se guardan en `localStorage`. Cambiarlas no reprocesa solo: hay que volver a **Run**. “Auto” omite el parámetro y Paddle usa su default interno.

## Uso

1. Arrastrar imágenes a la galería, elegir archivos, o pegar desde el portapapeles (Ctrl+V)
2. Elegir modo / tier / umbrales
3. Click **Run** o **Run All**
4. Revisar polígonos en el visor y editar texto a la derecha
5. Exportar JSON / CSV / TXT (texto editado; JSON incluye `poly`) o **PNG anotado** (`save_to_img` del motor)

## Stack

- Frontend: React 19 + TypeScript + Vite + Tailwind CSS v4
- Backend: FastAPI + PaddleOCR PP-OCRv6 (un solo `main.py`)

## Continuidad Engram (otro PC)

Memorias del proyecto versionadas para continuidad entre máquinas.

1. Tener el CLI `engram` instalado en el PATH.
2. En la raíz del repo, importar el export JSON:

```bash
engram import engram-export.json
```

3. (Opcional) Si hay chunks en `.engram/`, sincronizarlos a la DB local:

```bash
engram sync --import
```

No hace falta copiar `~/.engram/engram.db`; el export y los chunks bastan.
