# IDP OCR Studio — frontend

## Qué hace

Studio web: galería, visor con boxes, ResultText espacial, edición de palabras y export a formatos LLM-ready.

## Entrada / salida

- **Entrada:** archivos de imagen aceptados por el backend (vía upload API).
- **Salida:** UI + descargas JSON / MD / CSV / TXT / PNG anotado.

## Desarrollo

```bash
npm install
npm run dev
```

Backend por defecto: `http://localhost:8100`. Override:

```powershell
$env:VITE_API_URL="http://localhost:8100"
npm run dev
```

## Build

```bash
npm run build
```

## Qué no hace

No ejecuta OCR en el browser; no selecciona tier/mode (motor fixed medium en API).

## Archivos relacionados

- [src/README.md](src/README.md)
- [../docs/PRODUCT.md](../docs/PRODUCT.md)
