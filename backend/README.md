# IDP OCR Studio — backend

API FastAPI para cargar imágenes, ejecutar PaddleOCR y exportar resultados.

## Ejecución

Desde `backend/`:

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --host 0.0.0.0 --port 8100
```

La aplicación queda disponible en `http://127.0.0.1:8100` y la documentación OpenAPI en `/docs`.

## Endpoints

- `GET /health`: dispositivo y motores cargados.
- `POST /upload`: carga y normaliza una imagen de hasta 20 MB.
- `GET /image/{image_id}`: devuelve la imagen normalizada.
- `POST /infer/{image_id}`: ejecuta OCR con las opciones solicitadas.
- `POST /infer/batch`: procesa una lista de identificadores.
- `GET /status/{image_id}`: consulta el estado.
- `GET /export/{image_id}/annotated`: exporta la imagen anotada.

## Entorno

La aplicación configura automáticamente:

- `PADDLE_PDX_CACHE_HOME=backend/.paddlex`
- `PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True`

Paddle detecta CPU o `gpu:0` durante el warmup. Los archivos cargados y las
exportaciones se guardan bajo `backend/uploads/`.
