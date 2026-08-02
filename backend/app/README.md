# Paquete `app`

## Qué hace

Orquesta PP-OCRv6 medium: carga de motor, predict, parsing y rescate de texto vertical/diagonal.

## Módulos

- `main.py` — entorno PaddleX, lifespan, CORS, FastAPI
- `routes.py` — endpoints HTTP
- `schemas.py` — Pydantic (`InferOptions` sin selector de tier/mode)
- `storage.py` — validación y PNG
- `ocr.py` — device, motor único medium, predict
- `parsing.py` — normaliza salida Paddle → `OCRResult`
- `orientation.py` — segundo pase vertical/diagonal

## Orientación y rescate

Paddle solo clasifica línea 0°/180° y endereza crops muy altos. El rescate estima ángulo en el crop (`minAreaRect`), barre ±7.5/15 (y fallback de grilla) y reemplaza el texto solo si mejora la confianza (margen 0.02 en diagonales).

## Qué no hace

No expone selectores tiny/small ni mode document; el motor está fijo en medium.

## Archivos relacionados

- [../README.md](../README.md)
- [../../docs/PRODUCT.md](../../docs/PRODUCT.md)
