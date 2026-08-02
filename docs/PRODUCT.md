# Producto — IDP OCR Studio

## Misión

Extraer texto de **imágenes y documentos** (PDF / TIFF multipágina) y exportarlo a formatos **consumibles por un LLM** (JSON / Markdown / CSV / TXT), con revisión espacial en un studio local.

## Estado de versión

| Versión | Estado | Motor |
|---------|--------|--------|
| **v1** (este repo) | **Cerrada** (2026-07-30) + PDF/TIFF nativo | PP-OCRv6 medium + rescate angular |
| **v2** (próxima) | Planificada | **VLM** (vision-language); no seguir exprimiendo det+rec clásico — plan candidatos Baidu: [V2_BAIDU_VLM.md](V2_BAIDU_VLM.md) |

## Qué hace (v1)

1. Subir imágenes o PDF/TIFF  
2. OCR con PP-OCRv6 medium (escena o documento)  
3. Ver bounding boxes / ResultText espacial, editar texto  
4. Exportar JSON enriquecido, Markdown (LLM-ready), CSV, TXT y PNG anotado  

## Alcance (v1)

| Incluido | Excluido |
|----------|----------|
| Imágenes (PNG, JPEG, WEBP, GIF, BMP, ICO, PPM, AVIF) | StructureV3 / VL / HPD / ChatOCR |
| PDF y TIFF multipágina vía `PaddleOCR.predict` (tope 50 págs.) | Libs PDF ajenas (`pypdfium2`, Poppler, pdf2image) |
| Motor único PP-OCRv6 **medium** fijo | Multi-motor / cloud OCR / VLM (v2) / selector tiny-small |
| Doc: `use_doc_orientation_classify` + `use_doc_unwarping` | HPI (`enable_hpi`) — futuro Linux/WSL |
| Rescate angular por región (verticales + diagonales) | Girar la imagen entera |
| Export JSON / MD / CSV / TXT + PNG anotado | Official API cloud SDK (token opcional en `.env`) |
| Store in-memory + archivos en `backend/uploads/` | Persistencia entre reinicios, auth, Docker |

## Flujo (v1)

1. **Imagen** → PNG normalizado → det+rec escena (`use_textline_orientation`) → rescue  
2. **PDF/TIFF** → guardar original → `predict` engine documento (orientation + unwarping) → N Results (`page_index`) → PNG preview por página → rescue → galería N ítems  
3. UI espacial + edición  
4. Export (JSON con `reading_order` / `page_index`, Markdown para LLM)  

## Decisiones clave

- Diagonales: semilla en el crop + score del mismo `TextRecognition` medium.  
- Orquestar la API oficial Paddle 3.x (`text_det_*`, `dt_polys`); no inventar motores.  
- Multipágina: nativo PP-OCRv6; sin rasterizar PDF a mano.  
- **HPI** y **Official API** = futuro opcional (token local en `.env`, no usado por el pipeline local).  
- **v2 = VLM**: fin de iteración del pipeline clásico sobre nubes/diagonales. Candidatos Baidu documentados en [V2_BAIDU_VLM.md](V2_BAIDU_VLM.md) (Unlimited-OCR / Qianfan-OCR); v1 no se modifica.  

## Cómo validar

Checklist en el [README raíz](../README.md) y fixtures en [tests/fixtures/images](../tests/fixtures/images/README.md).
