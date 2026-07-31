# Producto — IDP OCR Studio

## Estado de versión

| Versión | Estado | Motor |
|---------|--------|--------|
| **v1** (este repo) | **Cerrada** (2026-07-30) | PP-OCRv6 medium + rescate angular |
| **v2** (próxima) | Planificada | **VLM** (vision-language), no más iterar el pipeline clásico det+rec sobre nubes/diagonales |

La v1 alcanza el techo razonable de OCR clásico para escenas artísticas (nubes de palabras). Mejoras finas tipo Hough no son el camino; la v2 cambia de paradigma a VLM.

## Qué hace (v1)

MVP académico low-code: subir imágenes, OCR con **PP-OCRv6 medium**, ver bounding boxes / ResultText espacial, editar texto y exportar.

## Alcance (v1)

| Incluido | Excluido |
|----------|----------|
| Imágenes (PNG, JPEG, WEBP, GIF, BMP, TIFF, ICO, PPM, AVIF) | PDF |
| Motor único PP-OCRv6 | Multi-motor / cloud OCR / VLM (eso es v2) |
| Tier **medium** fijo | Selector tiny/small |
| Rescate angular por región (verticales + diagonales) | Girar la imagen entera |
| Export JSON / MD / CSV / TXT + PNG anotado | Base de datos, auth, colas, Docker |
| Store in-memory + archivos en `backend/uploads/` | Persistencia entre reinicios |

## Flujo (v1)

1. Upload → PNG normalizado
2. Detección + reconocimiento Paddle (`use_textline_orientation` = 0°/180°)
3. Rescue: estimar ángulo en el crop (`minAreaRect`) + barrido fino ±7.5/15; re-reconocer; margen 0.02 en diagonales
4. UI espacial + edición
5. Export (JSON enriquecido con `reading_order`, Markdown para LLM)

## Decisiones clave

- `use_angle_cls` (2.x) = `use_textline_orientation` (3.x); solo 0/180, no diagonales.
- Diagonales: semilla en el crop + score del mismo `TextRecognition` medium.
- No inventar APIs Paddle; orquestar la oficial (`text_det_*`, `dt_polys`).
- **v2 = VLM**: no seguir exprimiendo DBNet/rescate angular para el “wow” en nubes.

## Cómo validar (v1)

Ver checklist en el [README raíz](../README.md) y fixtures en [tests/fixtures/images](../tests/fixtures/images/README.md).
