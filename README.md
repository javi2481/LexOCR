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

La primera ejecución descarga modelos de PaddleOCR (puede tardar). Cada combinación modo×tier se cachea al usarla por primera vez.

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

En el header:

| Control | Valores | Efecto |
|---------|---------|--------|
| Modo | Rápido / Documento | Documento activa orientación de página; orientación de líneas siempre on |
| Tier | tiny / small / medium | Velocidad vs precisión (PP-OCRv6) |
| Conf | 50–95% | Umbral de “baja confianza” (métricas y filtro) |

Las opciones se guardan en `localStorage`. Cambiarlas no reprocesa solo: hay que volver a **Run**.

## Uso

1. Arrastrar imágenes a la galería, elegir archivos, o pegar desde el portapapeles (Ctrl+V)
2. Elegir modo / tier / umbral
3. Click **Run** o **Run All**
4. Revisar polígonos en el visor y editar texto a la derecha
5. Exportar JSON / CSV / TXT (usa el texto editado; JSON incluye `poly`)

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
