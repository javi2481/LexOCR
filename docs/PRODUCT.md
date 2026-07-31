# Producto — IDP OCR Studio

## Qué hace

MVP académico low-code: subir imágenes, OCR con **PP-OCRv6 medium**, ver bounding boxes / ResultText espacial, editar texto y exportar.

## Alcance

| Incluido | Excluido |
|----------|----------|
| Imágenes (PNG, JPEG, WEBP, GIF, BMP, TIFF, ICO, PPM, AVIF) | PDF |
| Motor único PP-OCRv6 | Multi-motor / cloud OCR |
| Tier **medium** fijo | Selector tiny/small |
| Rescate angular por región (verticales + diagonales) | Girar la imagen entera |
| Export JSON / MD / CSV / TXT + PNG anotado | Base de datos, auth, colas, Docker |
| Store in-memory + archivos en `backend/uploads/` | Persistencia entre reinicios |

## Flujo

1. Upload → PNG normalizado
2. Detección + reconocimiento Paddle (`use_textline_orientation` = 0°/180°)
3. Rescue: rotar crop, re-reconocer, elegir mejor score → `orientation` en grados
4. UI espacial + edición
5. Export (JSON enriquecido con `reading_order`, Markdown para LLM)

## Decisiones clave

- `use_angle_cls` (2.x) = `use_textline_orientation` (3.x); solo 0/180, no diagonales.
- Diagonales: barrido ±30/45/60 + score del mismo `TextRecognition` medium.
- No inventar APIs Paddle; orquestar la oficial.

## Cómo validar

Ver checklist en el [README raíz](../README.md) y fixtures en [tests/fixtures/images](../tests/fixtures/images/README.md).
