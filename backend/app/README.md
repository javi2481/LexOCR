# Paquete `app`

## Módulos

- `main.py`: entorno PaddleX, ciclo de vida, CORS y creación de FastAPI.
- `routes.py`: registro de los endpoints HTTP.
- `schemas.py`: modelos Pydantic y tipos de opciones OCR.
- `storage.py`: rutas de archivos, validación y conversión a PNG.
- `ocr.py`: dispositivo, cachés, motores y ejecución de PaddleOCR.
- `parsing.py`: normalización de respuestas y construcción del resultado.
- `orientation.py`: segundo pase para texto vertical o diagonal.

## Orientación y rescate

PaddleOCR solo endereza automáticamente un recorte cuando su relación
alto/ancho es al menos 1.5, y su clasificador de línea distingue únicamente
0°/180°. El rescate rectifica cada cuadrilátero y prueba rotaciones verticales;
para regiones de baja confianza o gran área también barre ángulos diagonales.

El texto original solo se reemplaza cuando el reconocedor del segundo pase
mejora la confianza por el margen configurado. Si el rescate falla, la ruta
conserva sin cambios el resultado principal de PaddleOCR.
