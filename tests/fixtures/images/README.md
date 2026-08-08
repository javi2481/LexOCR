# Fixtures de imagen

## Qué hace

Imágenes versionadas para smoke manual: OCR + orientación + export.

## Entrada / salida

Entrada: archivos de esta carpeta (y PDFs/TIFF propios fuera del repo). Salida esperada:

- Imagen: `/upload` → `pending` → `/infer/{image_id}` → JSON con regiones y `orientation` (rescue ON).
- PDF/TIFF: `/upload` → `pages[]` cada una `pending` (PNG rasterizado) → `/infer` por `image_id` (en el studio la UI lo hace sola).

## Cómo probar

Con el backend en `:8100`:

```bash
curl -F "file=@tests/fixtures/images/poster.avif" http://localhost:8100/upload
# luego POST /infer/{image_id} con {"conf_threshold":0.9}

# Documento (raster en upload; OCR después):
curl -F "file=@tu-doc.pdf" http://localhost:8100/upload
# por cada pages[].image_id → POST /infer/{image_id}
```

| Archivo | Qué valida |
|---------|------------|
| `poster.avif` | AVIF + texto vertical (`TRY` ≈ −90°, `WERE` ≈ +90°) |
| `etiqueta-2.jpeg` / `etiqueta-3.jpeg` | Documentos / tipografía mixta |
| `nube-manzana.png` | Nube densa con diagonales |
| `nube-corazon.jpeg` | Nube con muchas orientaciones |
| PDF / TIFF propios (no versionados) | Multipágina: N `image_id`, `page_index`, tope 50 |

## Qué no hace

No versiona PDFs de prueba ni resultados OCR generados (van a `artifacts/` o `backend/uploads/`).

## Archivos relacionados

- [../../../docs/PRODUCT.md](../../../docs/PRODUCT.md)
- [../../../README.md](../../../README.md)
