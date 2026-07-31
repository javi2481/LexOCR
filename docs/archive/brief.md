# Brief T├®cnico ÔÇö IDP OCR Studio
## Documento de especificaciones para Cursor

---

## 1. Visi├│n del producto

**IDP OCR Studio** es una aplicaci├│n web SPA (Single Page Application) para procesamiento inteligente de documentos (IDP) mediante OCR. El usuario sube im├ígenes, elige un motor de OCR, ejecuta inferencia y visualiza los resultados en una interfaz de tres paneles: imagen original con bounding boxes, texto extra├¡do estructurado y m├®tricas de detecci├│n.

La identidad visual debe ser propia, moderna, dark-first (tema oscuro por defecto con toggle a claro), y debe sentirse como una herramienta profesional de an├ílisis de documentos, no como un producto gen├®rico.

---

## 2. Arquitectura general

```
ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ
Ôöé                    Frontend SPA (React/Vue/Svelte)          Ôöé
Ôöé  ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ  ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ  ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ  Ôöé
Ôöé  Ôöé  Dropzone   Ôöé  Ôöé  Viewer     Ôöé  Ôöé  Results + Metrics  Ôöé  Ôöé
Ôöé  Ôöé  + Gallery  Ôöé  Ôöé  (Canvas)   Ôöé  Ôöé  Panel              Ôöé  Ôöé
Ôöé  ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ  ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ  ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ  Ôöé
ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ
                              Ôöé
                              Ôû╝ HTTP/WS
ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ
Ôöé                    Backend API (FastAPI / Express / Flask)    Ôöé
Ôöé  ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ  ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ  ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ  Ôöé
Ôöé  Ôöé  Upload     Ôöé  Ôöé  OCR Router Ôöé  Ôöé  Queue / Batch      Ôöé  Ôöé
Ôöé  Ôöé  Handler    Ôöé  Ôöé  (Engines)  Ôöé  Ôöé  Processor          Ôöé  Ôöé
Ôöé  ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ  ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ  ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ  Ôöé
Ôöé         Ôöé                  Ôöé                                   Ôöé
Ôöé         Ôû╝                  Ôû╝                                   Ôöé
Ôöé  ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ  ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ  Ôöé
Ôöé  Ôöé  File Store Ôöé  Ôöé  OCR Engines (swappable)               Ôöé  Ôöé
Ôöé  Ôöé  (local/S3) Ôöé  Ôöé  ÔÇó PaddleOCR (default)                 Ôöé  Ôöé
Ôöé  ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ  Ôöé  ÔÇó EasyOCR                             Ôöé  Ôöé
Ôöé                   Ôöé  ÔÇó Tesseract                           Ôöé  Ôöé
Ôöé                   Ôöé  ÔÇó Future: cloud APIs                  Ôöé  Ôöé
Ôöé                   ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ  Ôöé
ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ
```

---

## 3. Stack tecnol├│gico recomendado

| Capa | Tecnolog├¡a | Justificaci├│n |
|------|-----------|---------------|
| **Frontend** | React 19 + TypeScript + Vite | SPA moderna, tipado fuerte, HMR r├ípido |
| **Estado** | Zustand | Ligero, sin boilerplate para manejo de im├ígenes y resultados OCR |
| **UI** | Tailwind CSS v4 + shadcn/ui | Sistema de dise├▒o consistente, componentes accesibles |
| **Canvas** | Fabric.js o Konva.js | Dibujo de bounding boxes interactivas sobre la imagen |
| **Backend** | FastAPI (Python) | Nativo para integrar PaddleOCR/EasyOCR, async por defecto |
| **OCR** | PaddleOCR (default) + EasyOCR + pytesseract | Motor swappable con adapter pattern |
| **Cola** | Celery + Redis o Python RQ | Procesamiento batch de im├ígenes en background |
| **DB** | SQLite (dev) / PostgreSQL (prod) | Metadatos de documentos, historial de inferencias |
| **Almacenamiento** | Local filesystem (dev) / MinIO o S3 (prod) | Im├ígenes subidas y resultados exportados |

---

## 4. Especificaciones de UI/UX

### 4.1 Layout principal (3 columnas en desktop, apilado en mobile)

```
ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ
Ôöé  [Logo]  IDP OCR Studio          [Selector Motor]  [Tema]  [User]   Ôöé
Ôö£ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔö¼ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔö¼ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöñ
Ôöé                Ôöé                             Ôöé                       Ôöé
Ôöé  GALER├ìA       Ôöé      VISOR DE IMAGEN        Ôöé   RESULTADOS          Ôöé
Ôöé  (izquierda)   Ôöé      (centro)               Ôöé   + M├ëTRICAS          Ôöé
Ôöé                Ôöé                             Ôöé   (derecha)           Ôöé
Ôöé  ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ  Ôöé  ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ    Ôöé  ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ  Ôöé
Ôöé  Ôöé thumb 1  Ôöé  Ôöé  Ôöé                     Ôöé    Ôöé  Ôöé Texto extra├¡do  Ôöé  Ôöé
Ôöé  Ôöé thumb 2  Ôöé  Ôöé  Ôöé   Imagen original   Ôöé    Ôöé  Ôöé (lista editable)Ôöé  Ôöé
Ôöé  Ôöé thumb 3  Ôöé  Ôöé  Ôöé   + bounding boxes  Ôöé    Ôöé  Ôöé                 Ôöé  Ôöé
Ôöé  Ôöé ...      Ôöé  Ôöé  Ôöé   coloreadas        Ôöé    Ôöé  Ôö£ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöñ  Ôöé
Ôöé  ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ  Ôöé  Ôöé                     Ôöé    Ôöé  Ôöé M├®tricas        Ôöé  Ôöé
Ôöé                Ôöé  ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ    Ôöé  Ôöé ÔÇó Confianza     Ôöé  Ôöé
Ôöé  [Subir imgs]  Ôöé  Zoom: [ÔêÆ] 100% [+]        Ôöé  Ôöé ÔÇó Tiempo        Ôöé  Ôöé
Ôöé  [Run All]     Ôöé  [Exportar imagen con BB]   Ôöé  Ôöé ÔÇó Regiones      Ôöé  Ôöé
Ôöé                Ôöé                             Ôöé  Ôöé ÔÇó Deltas        Ôöé  Ôöé
Ôöé                Ôöé                             Ôöé  ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ  Ôöé
Ôö£ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔö┤ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔö┤ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöñ
Ôöé  Status bar: Procesando 3/12 Ôöé ├Ültima inferencia: 0.84s Ôöé Batch #42 Ôöé
ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ
```

### 4.2 Panel izquierdo ÔÇö Galer├¡a

- **Dropzone** en la parte superior: arrastrar y soltar m├║ltiples im├ígenes (PNG, JPG, JPEG, BMP, GIF, PDF primera p├ígina).
- **Grid de thumbnails** 2 columnas, scrollable.
- Cada thumbnail muestra: miniatura de la imagen, nombre truncado, badge de estado (`pendiente` / `procesando` / `completado` / `error`).
- Click en thumbnail ÔåÆ carga esa imagen en el visor central.
- Doble click o bot├│n contextual ÔåÆ eliminar de la sesi├│n.
- Bot├│n "Run All Inference" ÔåÆ procesa todas las im├ígenes pendientes en secuencia.
- Bot├│n "Clear All" ÔåÆ limpia la sesi├│n actual.

### 4.3 Panel central ÔÇö Visor de imagen

- **Canvas interactivo** que muestra la imagen original a tama├▒o natural o con zoom.
- **Bounding boxes** dibujadas sobre la imagen, cada una con:
  - Borde de 2px con color ├║nico por regi├│n (paleta categ├│rica de 8+ colores).
  - Label flotante con n├║mero de orden y score de confianza.
  - Hover: resalta la BB y muestra tooltip con texto detectado + confianza.
  - Click: selecciona la regi├│n y scrollea autom├íticamente al texto correspondiente en el panel derecho.
- **Controles de zoom**: ÔêÆ / + / fit to screen / 100% / 200%.
- **Modos de visualizaci├│n**:
  - "Original": solo imagen.
  - "Con detecciones": imagen + BB.
  - "M├íscara": solo las regiones detectadas resaltadas, resto atenuado.
- **Exportar**: descargar imagen con las BB dibujadas (PNG).

### 4.4 Panel derecho ÔÇö Resultados y m├®tricas

#### Secci├│n A: Texto extra├¡do
- Lista de regiones detectadas, ordenadas top-to-bottom, left-to-right.
- Cada ├¡tem es **editable inline**:
  - Campo de texto con el OCR result.
  - Score de confianza con barra visual (verde >90%, amarillo 70-90%, rojo <70%).
  - Coordenadas de la BB (x, y, w, h) ÔÇö colapsable.
  - Bot├│n copiar al portapapeles.
- Hover sobre un ├¡tem ÔåÆ resalta la BB correspondiente en el visor central.
- Filtros: "Todas las regiones", "Solo baja confianza (<90%)", "Solo n├║meros", "Solo texto".
- Buscador en tiempo real sobre el texto extra├¡do.

#### Secci├│n B: M├®tricas de detecci├│n (collapsible)
Grid de 4 m├®tricas principales:
1. **Confianza promedio** ÔÇö % con delta vs ├║ltimo batch.
2. **Tiempo de inferencia** ÔÇö segundos por imagen + throughput (img/s).
3. **Regiones detectadas** ÔÇö total + breakdown por tipo (texto, n├║mero, tabla, etc.).
4. **Campos con baja confianza** ÔÇö count + lista clickable para revisi├│n r├ípida.

M├®tricas secundarias (expandibles):
- Precisi├│n del layout (detecci├│n de tablas, columnas).
- Uso de memoria durante inferencia.
- Throughput del motor seleccionado.
- Comparativa entre motores (si se proces├│ la misma imagen con m├ís de uno).

#### Secci├│n C: Exportar resultados
- JSON estructurado (coordenadas + texto + confianza).
- CSV (una fila por regi├│n).
- TXT plano.
- PDF con imagen anotada + texto al lado.

### 4.5 Selector de motor OCR

Dropdown en el header con los motores disponibles:
- **PaddleOCR** (default) ÔÇö badge "Recomendado".
- **EasyOCR** ÔÇö badge "Multilenguaje".
- **Tesseract** ÔÇö badge "Open source".
- Cada motor muestra: idiomas soportados, velocidad estimada, precisi├│n estimada.
- Al cambiar de motor, las im├ígenes ya procesadas se marcan como "reprocesar" (icono de refresh).

---

## 5. Flujo de usuario

```
1. Usuario entra a la app ÔåÆ sesi├│n vac├¡a, dropzone visible.
2. Arrastra/subir im├ígenes ÔåÆ thumbnails aparecen en galer├¡a (estado: pendiente).
3. Selecciona motor OCR en el dropdown.
4. Opci├│n A: Click en una imagen ÔåÆ inferencia individual ÔåÆ resultados en paneles.
   Opci├│n B: Click "Run All" ÔåÆ cola de procesamiento ÔåÆ thumbnails actualizan estado.
5. En el visor central, ve la imagen con BB coloreadas.
6. En el panel derecho, revisa texto extra├¡do, edita errores, revisa m├®tricas.
7. Exporta resultados en el formato deseado.
8. Puede subir m├ís im├ígenes o limpiar la sesi├│n.
```

---

## 6. Estructura de datos

### 6.1 Request ÔÇö Subir imagen
```json
POST /api/v1/upload
Content-Type: multipart/form-data

file: <binary>
engine: "paddleocr" | "easyocr" | "tesseract"
lang: "es" | "en" | "ch" | "multi"
```

### 6.2 Response ÔÇö Resultado OCR
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

### 6.3 WebSocket ÔÇö Progreso batch
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
- [ ] Soporte drag & drop de m├║ltiples im├ígenes.
- [ ] Procesamiento OCR con PaddleOCR como motor default.
- [ ] Visualizaci├│n de bounding boxes sobre imagen original.
- [ ] Lista de texto extra├¡do editable con scores de confianza.
- [ ] Panel de m├®tricas con al menos 4 KPIs visibles.
- [ ] Exportaci├│n a JSON, CSV, TXT.
- [ ] Selector swappable de motor OCR (m├¡nimo 3 opciones).
- [ ] Tema oscuro/claro persistente en localStorage.
- [ ] Responsive: layout de 3 columnas en desktop, apilado en mobile.
- [ ] Atajos de teclado: Ctrl+U (subir), Ctrl+R (run all), Ctrl+E (exportar), Ctrl+0 (zoom fit).

### Should have
- [ ] Procesamiento batch con cola (Celery/RQ).
- [ ] WebSocket para progreso en tiempo real.
- [ ] Comparativa lado a lado entre dos motores OCR.
- [ ] Detecci├│n autom├ítica de tablas y estructura jer├írquica.
- [ ] Historial de sesiones guardado en DB.
- [ ] Previsualizaci├│n de PDF (conversi├│n a imagen primera p├ígina).
- [ ] Filtros avanzados en resultados (por confianza, por tipo, por regex).

### Nice to have
- [ ] LLM post-procesamiento para corregir errores OCR contextuales.
- [ ] Reconocimiento de tipo de documento (factura, DNI, receta, etc.).
- [ ] Colaboraci├│n en tiempo real (m├║ltiples usuarios en misma sesi├│n).
- [ ] API p├║blica documentada (OpenAPI/Swagger).

---

## 8. Dise├▒o visual

### Identidad
- **Nombre**: IDP OCR Studio (o el nombre que elijas).
- **Paleta**: Dark-first. Fondo `#0f1115`, superficies `#1a1d23`, bordes `#2a2e36`. Acento principal `#6366f1` (indigo). ├ëxito `#22c55e`, warning `#f59e0b`, error `#ef4444`.
- **Tipograf├¡a**: Inter o Geist para UI, JetBrains Mono para datos t├®cnicos (coordenadas, scores).
- **Radii**: 8px para cards, 6px para botones, 12px para modales.
- **Sombras**: sutiles, solo en elementos elevados (dropdowns, modales).
- **Iconograf├¡a**: Lucide React (consistente, outline style).

### Estados de carga
- Skeleton screens en galer├¡a mientras se cargan thumbnails.
- Spinner en el visor central mientras corre inferencia.
- Progress bar indeterminada en status bar para batch processing.
- Toast notifications para errores y ├®xitos (Sonner o similar).

---

## 9. Consideraciones t├®cnicas

### Performance
- Las im├ígenes deben redimensionarse en frontend antes de subir (max 2048px en el lado mayor).
- Lazy loading de thumbnails.
- Virtualizaci├│n de la lista de regiones si hay >100 detecciones.
- Canvas con GPU acceleration para el visor (evitar re-renders innecesarios).

### Seguridad
- Validar tipos MIME y magic numbers de archivos subidos.
- L├¡mite de tama├▒o: 20MB por imagen, 50 im├ígenes por batch.
- Sanitizar texto extra├¡do antes de mostrar en UI (XSS prevention).
- Rate limiting en endpoints de inferencia.

### Accesibilidad
- ARIA labels en todos los controles del canvas.
- Navegaci├│n por teclado en la galer├¡a (flechas, Enter para seleccionar).
- Contraste WCAG AA m├¡nimo en todos los textos.
- Screen reader friendly en la lista de resultados.

---

## 10. Estructura de carpetas sugerida (frontend)

```
frontend/
Ôö£ÔöÇÔöÇ src/
Ôöé   Ôö£ÔöÇÔöÇ app/
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ layout.tsx
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ page.tsx                    ÔåÉ Main workspace (3 paneles)
Ôöé   Ôöé   ÔööÔöÇÔöÇ globals.css
Ôöé   Ôö£ÔöÇÔöÇ components/
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ gallery/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ ImageGallery.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ ThumbnailCard.tsx
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ UploadDropzone.tsx
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ viewer/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ ImageViewer.tsx         ÔåÉ Canvas con Fabric/Konva
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ BoundingBoxLayer.tsx
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ ZoomControls.tsx
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ results/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ ExtractedTextList.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ TextRegionItem.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ MetricsPanel.tsx
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ ExportMenu.tsx
Ôöé   Ôöé   ÔööÔöÇÔöÇ ui/                         ÔåÉ shadcn/ui components
Ôöé   Ôö£ÔöÇÔöÇ hooks/
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ useOCR.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ useCanvas.ts
Ôöé   Ôöé   ÔööÔöÇÔöÇ useBatchProcessor.ts
Ôöé   Ôö£ÔöÇÔöÇ stores/
Ôöé   Ôöé   ÔööÔöÇÔöÇ sessionStore.ts             ÔåÉ Zustand
Ôöé   Ôö£ÔöÇÔöÇ types/
Ôöé   Ôöé   ÔööÔöÇÔöÇ ocr.ts                      ÔåÉ Interfaces de OCR response
Ôöé   Ôö£ÔöÇÔöÇ lib/
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ api.ts                      ÔåÉ Axios/fetch client
Ôöé   Ôöé   ÔööÔöÇÔöÇ utils.ts
Ôöé   ÔööÔöÇÔöÇ engines/
Ôöé       Ôö£ÔöÇÔöÇ paddleAdapter.ts
Ôöé       Ôö£ÔöÇÔöÇ easyocrAdapter.ts
Ôöé       ÔööÔöÇÔöÇ tesseractAdapter.ts
Ôö£ÔöÇÔöÇ public/
ÔööÔöÇÔöÇ package.json
```

---

## 11. Endpoints API (backend)

| M├®todo | Endpoint | Descripci├│n |
|--------|----------|-------------|
| POST | `/api/v1/upload` | Subir imagen(es), retorna image_id |
| POST | `/api/v1/infer/{image_id}` | Ejecutar OCR sobre imagen espec├¡fica |
| POST | `/api/v1/infer/batch` | Ejecutar OCR sobre todas las pendientes |
| GET | `/api/v1/infer/{image_id}/status` | Estado de procesamiento |
| GET | `/api/v1/infer/{image_id}/result` | Obtener resultado OCR |
| GET | `/api/v1/engines` | Listar motores OCR disponibles |
| POST | `/api/v1/export/{image_id}` | Exportar resultados (formato en body) |
| WS | `/ws/batch/{batch_id}` | Progreso en tiempo real |

---

## 12. Criterios de aceptaci├│n

1. El usuario puede subir 10+ im├ígenes y verlas en la galer├¡a sin recargar la p├ígina.
2. Al hacer click en "Run All", todas las im├ígenes se procesan y los thumbnails actualizan su estado.
3. El visor central muestra bounding boxes exactamente sobre las regiones de texto detectadas.
4. Al pasar el mouse sobre una BB, se resalta y muestra tooltip con texto + confianza.
5. Al pasar el mouse sobre un ├¡tem de texto en el panel derecho, se resalta la BB correspondiente.
6. El texto extra├¡do es editable inline y los cambios persisten en la sesi├│n.
7. Las m├®tricas se actualizan en tiempo real durante el procesamiento batch.
8. El selector de motor OCR permite cambiar entre PaddleOCR, EasyOCR y Tesseract.
9. La app es usable en pantallas de 1366px de ancho (layout adaptativo).
10. El tema oscuro es el default y se respeta en todos los componentes.

---

*Brief generado para Cursor ÔÇö IDP OCR Studio*
