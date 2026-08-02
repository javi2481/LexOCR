# Fixtures de imagen

## Qué hace

Imágenes versionadas para smoke manual: OCR + orientación + export.

## Entrada / salida

Entrada: archivos de esta carpeta. Salida esperada: `/upload` + `/infer` → JSON con regiones y `orientation`.

## Cómo probar

Con el backend en `:8100`:

```bash
curl -F "file=@tests/fixtures/images/poster.avif" http://localhost:8100/upload
# luego POST /infer/{image_id} con {"conf_threshold":0.9}
```

| Archivo | Qué valida |
|---------|------------|
| `poster.avif` | AVIF + texto vertical (`TRY` ≈ −90°, `WERE` ≈ +90°) |
| `etiqueta-2.jpeg` / `etiqueta-3.jpeg` | Documentos / tipografía mixta |
| `nube-manzana.png` | Nube densa con diagonales |
| `nube-corazon.jpeg` | Nube con muchas orientaciones |

## Qué no hace

No incluye PDFs ni resultados OCR generados (van a `artifacts/` o uploads locales).

## Archivos relacionados

- [../../../docs/PRODUCT.md](../../../docs/PRODUCT.md)
- [../../../README.md](../../../README.md)
