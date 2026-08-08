# Producto — LexOCR

## Misión

Extraer texto de **imágenes y documentos** (PDF / TIFF multipágina) y exportarlo a formatos **consumibles por un LLM** (JSON / Markdown / CSV / TXT), con revisión espacial en un studio local.

## Estado de versión

| Versión | Estado | Motor |
|---------|--------|-------|
| **v1** (este repo) | **Cerrada** (2026-07-30) + PDF/TIFF por raster | PP-OCRv6 medium + rescate angular (imágenes) |
| **v2** (próxima) | Planificada | **VLM** (vision-language); no seguir exprimiendo det+rec clásico — plan candidatos Baidu: [V2_BAIDU_VLM.md](V2_BAIDU_VLM.md) |

## Qué hace (v1)

1. Subir imágenes o PDF/TIFF  
2. OCR con PP-OCRv6 medium (un solo engine escena)  
3. Ver bounding boxes / ResultText espacial, editar texto  
4. Exportar JSON enriquecido, Markdown (LLM-ready), CSV, TXT y PNG anotado  

## Alcance (v1)

| Incluido | Excluido |
|----------|----------|
| Imágenes (PNG, JPEG, WEBP, GIF, BMP, ICO, PPM, AVIF) | StructureV3 / VL / HPD / ChatOCR |
| PDF (`pypdfium2`) y TIFF (Pillow), tope 50 págs. / ≤20 MB | Poppler / pdf2image; predict nativo multipágina Paddle |
| Motor único PP-OCRv6 **medium** fijo (escena) | Engine documento con `doc_orientation` / unwarping; multi-motor / cloud OCR / VLM (v2) |
| `use_textline_orientation` (0°/180° de línea) | HPI (`enable_hpi`) — futuro Linux/WSL |
| Rescate angular por región en **imágenes** (verticales + diagonales) | Rescue en PDF/TIFF; girar la imagen entera |
| Export JSON / MD / CSV / TXT + PNG anotado | Official API cloud SDK (token opcional en `.env`) |
| Store in-memory + archivos en `backend/uploads/` | Persistencia entre reinicios, auth, Docker |

## Flujo (v1)

1. **Imagen** → PNG normalizado → `pending` → `/infer` escena (`use_textline_orientation`) → rescue → galería  
2. **PDF/TIFF** → guardar original → raster por página (`pypdfium2` / Pillow, ~scale 2.0) → N PNG `pending` → UI auto-`/infer` por página (**sin** rescue) → galería N ítems (`page_index` / `page_count`)  
3. UI espacial + edición (vista página / documento)  
4. Export (JSON con `reading_order` / `page_index`, Markdown para LLM; PNG vía `annotate.py` sin re-OCR)  

## Decisiones clave

- Diagonales (imágenes): semilla en el crop + score del mismo `TextRecognition` medium.  
- Orquestar la API oficial Paddle 3.x (`text_det_*`, `dt_polys`); no inventar motores.  
- Multipágina: raster explícito + `/infer` por página; UVDoc / doc_ori OFF (lento en CPU).  
- **HPI** y **Official API** = futuro opcional (token local en `.env`, no usado por el pipeline local).  
- **v2 = VLM**: fin de iteración del pipeline clásico sobre nubes/diagonales. Candidatos Baidu documentados en [V2_BAIDU_VLM.md](V2_BAIDU_VLM.md) (Unlimited-OCR / Qianfan-OCR); v1 no se modifica.  

## Cómo validar

Checklist en el [README raíz](../README.md) y fixtures en [tests/fixtures/images](../tests/fixtures/images/README.md).
