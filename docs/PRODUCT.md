# Producto — IDP OCR Studio

## Misión

Extraer texto de **imágenes** y exportarlo a formatos **consumibles por un LLM** (JSON / Markdown / CSV / TXT), con revisión espacial en un studio local.

## Estado de versión

| Versión | Estado | Motor |
|---------|--------|--------|
| **v1** (este repo) | **Cerrada** (2026-07-30) | PP-OCRv6 medium + rescate angular |
| **v2** (próxima) | Planificada | **VLM** (vision-language); no seguir exprimiendo det+rec clásico |

## Qué hace (v1)

1. Subir imágenes  
2. OCR con PP-OCRv6 medium  
3. Ver bounding boxes / ResultText espacial, editar texto  
4. Exportar JSON enriquecido, Markdown (LLM-ready), CSV, TXT y PNG anotado  

## Alcance (v1)

| Incluido | Excluido |
|----------|----------|
| Imágenes (PNG, JPEG, WEBP, GIF, BMP, TIFF, ICO, PPM, AVIF) | PDF |
| Motor único PP-OCRv6 **medium** fijo | Multi-motor / cloud OCR / VLM (v2) / selector tiny-small |
| Rescate angular por región (verticales + diagonales) | Girar la imagen entera |
| Export JSON / MD / CSV / TXT + PNG anotado | Base de datos, auth, colas, Docker |
| Store in-memory + archivos en `backend/uploads/` | Persistencia entre reinicios |

## Flujo (v1)

1. Upload → PNG normalizado  
2. Detección + reconocimiento Paddle (`use_textline_orientation` = 0°/180°)  
3. Rescue: ángulo en el crop (`minAreaRect`) + barrido fino ±7.5/15; re-reconocer; margen 0.02 en diagonales  
4. UI espacial + edición  
5. Export (JSON con `reading_order`, Markdown para LLM)  

## Decisiones clave

- Diagonales: semilla en el crop + score del mismo `TextRecognition` medium.  
- Orquestar la API oficial Paddle 3.x (`text_det_*`, `dt_polys`); no inventar motores.  
- **v2 = VLM**: fin de iteración del pipeline clásico sobre nubes/diagonales.  

## Cómo validar

Checklist en el [README raíz](../README.md) y fixtures en [tests/fixtures/images](../tests/fixtures/images/README.md).
