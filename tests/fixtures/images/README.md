# Fixtures de imagen

## Qué hace

Imágenes de prueba versionadas para smoke manual y e2e local.

## Entrada / salida

Entrada: archivos de esta carpeta. Salida: respuesta de `/upload` + `/infer` (JSON con regiones y `orientation`).

## Cómo probar

Con el backend en `:8100`:

```bash
curl -F "file=@tests/fixtures/images/poster.avif" http://localhost:8100/upload
# luego POST /infer/{image_id} con {"mode":"fast","tier":"medium","conf_threshold":0.9}
```

## Decisiones clave

| Archivo | Qué valida |
|---------|------------|
| `poster.avif` | AVIF + texto vertical (`TRY` ≈ −90°, `WERE` ≈ +90°) |
| `etiqueta-2.jpeg` / `etiqueta-3.jpeg` | Documentos / tipografía mixta |
| `nube-manzana.png` | Nube densa con diagonales |
| `nube-corazon.jpeg` | Nube con muchas orientaciones |

Nombres sin espacios para scripts y docs multiplataforma.

## Qué no hace

No incluye PDFs ni resultados OCR generados (van a `artifacts/`).

## Archivos relacionados

- [docs/PRODUCT.md](../../../docs/PRODUCT.md)
- [backend/README.md](../../../backend/README.md)
