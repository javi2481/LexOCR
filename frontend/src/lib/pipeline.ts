/** Etapas visibles del pipeline OCR (barra de progreso del header). */
export type BusyStage = "prepare" | "ingest" | "ocr";

export const PIPELINE_STAGES: { id: BusyStage; label: string; hint: string }[] = [
  { id: "prepare", label: "Preparar", hint: "Armar la sesión de trabajo" },
  { id: "ingest", label: "Cargar", hint: "Subir imagen o rasterizar PDF/TIFF" },
  { id: "ocr", label: "OCR", hint: "Detectar y reconocer texto" },
];
