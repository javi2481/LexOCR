# Brief Técnico — IDP OCR Studio
## Documento de especificaciones para Cursor

---

## 1. Visión del producto

**IDP OCR Studio** es una aplicación web SPA (Single Page Application) para procesamiento inteligente de documentos (IDP) mediante OCR. El usuario sube imágenes, elige un motor de OCR, ejecuta inferencia y visualiza los resultados en una interfaz de tres paneles: imagen original con bounding boxes, texto extraído estructurado y métricas de detección.

La identidad visual debe ser propia, moderna, dark-first (tema oscuro por defecto con toggle a claro), y debe sentirse como una herramienta profesional de análisis de documentos, no como un producto genérico.

---

## 2. Arquitectura general

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend SPA (React/Vue/Svelte)          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Dropzone   │  │  Viewer     │  │  Results + Metrics  │  │
│  │  + Gallery  │  │  (Canvas)   │  │  Panel              │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP/WS
┌─────────────────────────────────────────────────────────────┐
│                    Backend API (FastAPI / Express / Flask)    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Upload     │  │  OCR Router │  │  Queue / Batch      │  │
│  │  Handler    │  │  (Engines)  │  │  Processor          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         │                  │                                   │
│         ▼                  ▼                                   │
│  ┌─────────────┐  ┌────────────────────────────────────────┐  │
│  │  File Store │  │  OCR Engines (swappable)               │  │
│  │  (local/S3) │  │  • PaddleOCR (default)                 │  │
│  └─────────────┘  │  • EasyOCR                             │  │
│                   │  • Tesseract                           │  │
│                   │  • Future: cloud APIs                  │  │
│                   └────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Stack tecnológico recomendado

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| **Frontend** | React 19 + TypeScript + Vite | SPA moderna, tipado fuerte, HMR rápido |
| **Estado** | Zustand | Ligero, sin boilerplate para manejo de imágenes y resultados OCR |
| **UI** | Tailwind CSS v4 + shadcn/ui | Sistema de diseño consistente, componentes accesibles |
| **Canvas** | Fabric.js o Konva.js | Dibujo de bounding boxes interactivas sobre la imagen |
| **Backend** | FastAPI (Python) | Nativo para integrar PaddleOCR/EasyOCR, async por defecto |
| **OCR** | PaddleOCR (default) + EasyOCR + pytesseract | Motor swappable con adapter pattern |
| **Cola** | Celery + Redis o Python RQ | Procesamiento batch de imágenes en background |
| **DB** | SQLite (dev) / PostgreSQL (prod) | Metadatos de documentos, historial de inferencias |
| **Almacenamiento** | Local filesystem (dev) / MinIO o S3 (prod) | Imágenes subidas y resultados exportados |

---

## 4. Especificaciones de UI/UX

### 4.1 Layout principal (3 columnas en desktop, apilado en mobile)

```
┌──────────────────────────────────────────────────────────────────────┐
│  [Logo]  IDP OCR Studio          [Selector Motor]  [Tema]  [User]   │
├────────────────┬─────────────────────────────┬───────────────────────┤
│                │                             │                       │
│  GALERÍA       │      VISOR DE IMAGEN        │   RESULTADOS          │
│  (izquierda)   │      (centro)               │   + MÉTRICAS          │
│                │                             │   (derecha)           │
│  ┌──────────┐  │  ┌─────────────────────┐    │  ┌─────────────────┐  │
│  │ thumb 1  │  │  │                     │    │  │ Texto extraído  │  │
│  │ thumb 2  │  │  │   Imagen original   │    │  │ (lista editable)│  │
│  │ thumb 3  │  │  │   + bounding boxes  │    │  │                 │  │
│  │ ...      │  │  │   coloreadas        │    │  ├─────────────────┤  │
│  └──────────┘  │  │                     │    │  │ Métricas        │  │
│                │  └─────────────────────┘    │  │ • Confianza     │  │
│  [Subir imgs]  │  Zoom: [−] 100% [+]        │  │ • Tiempo        │  │
│  [Run All]     │  [Exportar imagen con BB]   │  │ • Regiones      │  │
│                │                             │  │ • Deltas        │  │
│                │                             │  └─────────────────┘  │
├────────────────┴─────────────────────────────┴───────────────────────┤
│  Status bar: Procesando 3/12 │ Última inferencia: 0.84s │ Batch #42 │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 Panel izquierdo — Galería

- **Dropzone** en la parte superior: arrastrar y soltar múltiples imágenes (PNG, JPG, JPEG, BMP, GIF, PDF primera página).
- **Grid de thumbnails** 2 columnas, scrollable.
- Cada thumbnail muestra: miniatura de la imagen, nombre truncado, badge de estado (`pendiente` / `procesando` / `completado` / `error`).
- Click en thumbnail → carga esa imagen en el visor central.
- Doble click o botón contextual → eliminar de la sesión.
- Botón "Run All Inference" → procesa todas las imágenes pendientes en secuencia.
- Botón "Clear All" → limpia la sesión actual.

### 4.3 Panel central — Visor de imagen

- **Canvas interactivo** que muestra la imagen original a tamaño natural o con zoom.
- **Bounding boxes** dibujadas sobre la imagen, cada una con:
  - Borde de 2px con color único por región (paleta categórica de 8+ colores).
  - Label flotante con número de orden y score de confianza.
  - Hover: resalta la BB y muestra tooltip con texto detectado + confianza.
  - Click: selecciona la región y scrollea automáticamente al texto correspondiente en el panel derecho.
- **Controles de zoom**: − / + / fit to screen / 100% / 200%.
- **Modos de visualización**:
  - "Original": solo imagen.
  - "Con detecciones": imagen + BB.
  - "Máscara": solo las regiones detectadas resaltadas, resto atenuado.
- **Exportar**: descargar imagen con las BB dibujadas (PNG).

### 4.4 Panel derecho — Resultados y métricas

#### Sección A: Texto extraído
- Lista de regiones detectadas, ordenadas top-to-bottom, left-to-right.
- Cada ítem es **editable inline**:
  - Campo de texto con el OCR result.
  - Score de confianza con barra visual (verde >90%, amarillo 70-90%, rojo <70%).
  - Coordenadas de la BB (x, y, w, h) — colapsable.
  - Botón copiar al portapapeles.
- Hover sobre un ítem → resalta la BB correspondiente en el visor central.
- Filtros: "Todas las regiones", "Solo baja confianza (<90%)", "Solo números", "Solo texto".
- Buscador en tiempo real sobre el texto extraído.

#### Sección B: Métricas de detección (collapsible)
Grid de 4 métricas principales:
1. **Confianza promedio** — % con delta vs último batch.
2. **Tiempo de inferencia** — segundos por imagen + throughput (img/s).
3. **Regiones detectadas** — total + breakdown por tipo (texto, número, tabla, etc.).
4. **Campos con baja confianza** — count + lista clickable para revisión rápida.

Métricas secundarias (expandibles):
- Precisión del layout (detección de tablas, columnas).
- Uso de memoria durante inferencia.
- Throughput del motor seleccionado.
- Comparativa entre motores (si se procesó la misma imagen con más de uno).

#### Sección C: Exportar resultados
- JSON estructurado (coordenadas + texto + confianza).
- CSV (una fila por región).
- TXT plano.
- PDF con imagen anotada + texto al lado.

### 4.5 Selector de motor OCR

Dropdown en el header con los motores disponibles:
- **PaddleOCR** (default) — badge "Recomendado".
- **EasyOCR** — badge "Multilenguaje".
- **Tesseract** — badge "Open source".
- Cada motor muestra: idiomas soportados, velocidad estimada, precisión estimada.
- Al cambiar de motor, las imágenes ya procesadas se marcan como "reprocesar" (icono de refresh).

---

## 5. Flujo de usuario

```
1. Usuario entra a la app → sesión vacía, dropzone visible.
2. Arrastra/subir imágenes → thumbnails aparecen en galería (estado: pendiente).
3. Selecciona motor OCR en el dropdown.
4. Opción A: Click en una imagen → inferencia individual → resultados en paneles.
   Opción B: Click "Run All" → cola de procesamiento → thumbnails actualizan estado.
5. En el visor central, ve la imagen con BB coloreadas.
6. En el panel derecho, revisa texto extraído, edita errores, revisa métricas.
7. Exporta resultados en el formato deseado.
8. Puede subir más imágenes o limpiar la sesión.
```

---

## 6. Estructura de datos

### 6.1 Request — Subir imagen
```json
POST /api/v1/upload
Content-Type: multipart/form-data

file: <binary>
engine: "paddleocr" | "easyocr" | "tesseract"
lang: "es" | "en" | "ch" | "multi"
```

### 6.2 Response — Resultado OCR
```json
{
  "batch_id": "uuid",
  "image_id": "uuid",
  "filename": "factura_001.jpg",
  "engine": "paddleocr",
  "status": "completed",
  "metrics": {
    "inference_time_ms": 840,
    "confidence_avg": 0.973,
    "regions_count": 8,
    "low_confidence_count": 0,
    "throughput_ips": 1.19
  },
  "regions": [
    {
      "id": 0,
      "text": "FACTURA A",
      "confidence": 0.992,
      "bbox": {
        "x": 35, "y": 38, "width": 160, "height": 28
      },
      "type": "text",
      "language": "es"
    }
  ],
  "dimensions": {
    "width": 1200,
    "height": 800
  }
}
```

### 6.3 WebSocket — Progreso batch
```json
{
  "type": "batch_progress",
  "batch_id": "uuid",
  "total": 12,
  "completed": 7,
  "current_image": "doc_007.png",
  "eta_seconds": 4.2
}
```

---

## 7. Requisitos funcionales

### Must have
- [ ] SPA con routing opcional (/, /history, /settings).
- [ ] Soporte drag & drop de múltiples imágenes.
- [ ] Procesamiento OCR con PaddleOCR como motor default.
- [ ] Visualización de bounding boxes sobre imagen original.
- [ ] Lista de texto extraído editable con scores de confianza.
- [ ] Panel de métricas con al menos 4 KPIs visibles.
- [ ] Exportación a JSON, CSV, TXT.
- [ ] Selector swappable de motor OCR (mínimo 3 opciones).
- [ ] Tema oscuro/claro persistente en localStorage.
- [ ] Responsive: layout de 3 columnas en desktop, apilado en mobile.
- [ ] Atajos de teclado: Ctrl+U (subir), Ctrl+R (run all), Ctrl+E (exportar), Ctrl+0 (zoom fit).

### Should have
- [ ] Procesamiento batch con cola (Celery/RQ).
- [ ] WebSocket para progreso en tiempo real.
- [ ] Comparativa lado a lado entre dos motores OCR.
- [ ] Detección automática de tablas y estructura jerárquica.
- [ ] Historial de sesiones guardado en DB.
- [ ] Previsualización de PDF (conversión a imagen primera página).
- [ ] Filtros avanzados en resultados (por confianza, por tipo, por regex).

### Nice to have
- [ ] LLM post-procesamiento para corregir errores OCR contextuales.
- [ ] Reconocimiento de tipo de documento (factura, DNI, receta, etc.).
- [ ] Colaboración en tiempo real (múltiples usuarios en misma sesión).
- [ ] API pública documentada (OpenAPI/Swagger).

---

## 8. Diseño visual

### Identidad
- **Nombre**: IDP OCR Studio (o el nombre que elijas).
- **Paleta**: Dark-first. Fondo `#0f1115`, superficies `#1a1d23`, bordes `#2a2e36`. Acento principal `#6366f1` (indigo). Éxito `#22c55e`, warning `#f59e0b`, error `#ef4444`.
- **Tipografía**: Inter o Geist para UI, JetBrains Mono para datos técnicos (coordenadas, scores).
- **Radii**: 8px para cards, 6px para botones, 12px para modales.
- **Sombras**: sutiles, solo en elementos elevados (dropdowns, modales).
- **Iconografía**: Lucide React (consistente, outline style).

### Estados de carga
- Skeleton screens en galería mientras se cargan thumbnails.
- Spinner en el visor central mientras corre inferencia.
- Progress bar indeterminada en status bar para batch processing.
- Toast notifications para errores y éxitos (Sonner o similar).

---

## 9. Consideraciones técnicas

### Performance
- Las imágenes deben redimensionarse en frontend antes de subir (max 2048px en el lado mayor).
- Lazy loading de thumbnails.
- Virtualización de la lista de regiones si hay >100 detecciones.
- Canvas con GPU acceleration para el visor (evitar re-renders innecesarios).

### Seguridad
- Validar tipos MIME y magic numbers de archivos subidos.
- Límite de tamaño: 20MB por imagen, 50 imágenes por batch.
- Sanitizar texto extraído antes de mostrar en UI (XSS prevention).
- Rate limiting en endpoints de inferencia.

### Accesibilidad
- ARIA labels en todos los controles del canvas.
- Navegación por teclado en la galería (flechas, Enter para seleccionar).
- Contraste WCAG AA mínimo en todos los textos.
- Screen reader friendly en la lista de resultados.

---

## 10. Estructura de carpetas sugerida (frontend)

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    ← Main workspace (3 paneles)
│   │   └── globals.css
│   ├── components/
│   │   ├── gallery/
│   │   │   ├── ImageGallery.tsx
│   │   │   ├── ThumbnailCard.tsx
│   │   │   └── UploadDropzone.tsx
│   │   ├── viewer/
│   │   │   ├── ImageViewer.tsx         ← Canvas con Fabric/Konva
│   │   │   ├── BoundingBoxLayer.tsx
│   │   │   └── ZoomControls.tsx
│   │   ├── results/
│   │   │   ├── ExtractedTextList.tsx
│   │   │   ├── TextRegionItem.tsx
│   │   │   ├── MetricsPanel.tsx
│   │   │   └── ExportMenu.tsx
│   │   └── ui/                         ← shadcn/ui components
│   ├── hooks/
│   │   ├── useOCR.ts
│   │   ├── useCanvas.ts
│   │   └── useBatchProcessor.ts
│   ├── stores/
│   │   └── sessionStore.ts             ← Zustand
│   ├── types/
│   │   └── ocr.ts                      ← Interfaces de OCR response
│   ├── lib/
│   │   ├── api.ts                      ← Axios/fetch client
│   │   └── utils.ts
│   └── engines/
│       ├── paddleAdapter.ts
│       ├── easyocrAdapter.ts
│       └── tesseractAdapter.ts
├── public/
└── package.json
```

---

## 11. Endpoints API (backend)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/upload` | Subir imagen(es), retorna image_id |
| POST | `/api/v1/infer/{image_id}` | Ejecutar OCR sobre imagen específica |
| POST | `/api/v1/infer/batch` | Ejecutar OCR sobre todas las pendientes |
| GET | `/api/v1/infer/{image_id}/status` | Estado de procesamiento |
| GET | `/api/v1/infer/{image_id}/result` | Obtener resultado OCR |
| GET | `/api/v1/engines` | Listar motores OCR disponibles |
| POST | `/api/v1/export/{image_id}` | Exportar resultados (formato en body) |
| WS | `/ws/batch/{batch_id}` | Progreso en tiempo real |

---

## 12. Criterios de aceptación

1. El usuario puede subir 10+ imágenes y verlas en la galería sin recargar la página.
2. Al hacer click en "Run All", todas las imágenes se procesan y los thumbnails actualizan su estado.
3. El visor central muestra bounding boxes exactamente sobre las regiones de texto detectadas.
4. Al pasar el mouse sobre una BB, se resalta y muestra tooltip con texto + confianza.
5. Al pasar el mouse sobre un ítem de texto en el panel derecho, se resalta la BB correspondiente.
6. El texto extraído es editable inline y los cambios persisten en la sesión.
7. Las métricas se actualizan en tiempo real durante el procesamiento batch.
8. El selector de motor OCR permite cambiar entre PaddleOCR, EasyOCR y Tesseract.
9. La app es usable en pantallas de 1366px de ancho (layout adaptativo).
10. El tema oscuro es el default y se respeta en todos los componentes.

---

*Brief generado para Cursor — IDP OCR Studio*
