# IDP OCR Studio frontend

## Desarrollo

```bash
npm install
npm run dev
```

Vite abre la aplicación local. El backend OCR se consulta en
`http://localhost:8100` por defecto.

Para usar otra URL, definí `VITE_API_URL` antes de iniciar Vite:

```bash
VITE_API_URL=http://localhost:8100 npm run dev
```

En PowerShell:

```powershell
$env:VITE_API_URL="http://localhost:8100"
npm run dev
```

## Build

```bash
npm run build
```
