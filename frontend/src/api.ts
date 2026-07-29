const API = import.meta.env.VITE_API_URL ?? "http://localhost:8100";

export type OcrMode = "fast" | "document";
export type OcrTier = "tiny" | "small" | "medium";

export type InferOptions = {
  mode: OcrMode;
  tier: OcrTier;
  conf_threshold: number;
  /** Solo si se setean; ausentes → default interno de Paddle */
  text_det_box_thresh?: number;
  text_det_thresh?: number;
  text_det_unclip_ratio?: number;
  text_det_limit_side_len?: number;
  text_det_limit_type?: string;
};

export type Region = {
  id: number;
  text: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
  poly?: number[][];
};

export type OCRResult = {
  image_id: string;
  filename: string;
  status: string;
  inference_time_ms: number;
  confidence_avg: number;
  regions_count: number;
  low_confidence_count: number;
  regions: Region[];
  width: number;
  height: number;
  ocr_mode?: OcrMode;
  ocr_tier?: OcrTier;
  conf_threshold?: number;
};

export type UploadResponse = {
  image_id: string;
  filename: string;
  preview_url?: string;
  source_format?: string;
};

export type HealthInfo = {
  ok: boolean;
  cuda_compiled: boolean;
  device: string;
  engines_cached?: number;
};

export const DEFAULT_INFER_OPTIONS: InferOptions = {
  mode: "fast",
  tier: "medium",
  conf_threshold: 0.9,
};

/** Defaults oficiales PaddleOCR 3.x (solo UI; no se envían hasta que el usuario los fija). */
export const OFFICIAL_DET_DEFAULTS = {
  text_det_thresh: 0.3,
  text_det_box_thresh: 0.6,
  text_det_unclip_ratio: 2.0,
} as const;

export const imageUrl = (imageId: string) => `${API}/image/${imageId}`;

export const annotatedExportUrl = (imageId: string) => `${API}/export/${imageId}/annotated`;

export async function getHealth(): Promise<HealthInfo> {
  const res = await fetch(`${API}/health`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function upload(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function infer(imageId: string, options: InferOptions = DEFAULT_INFER_OPTIONS): Promise<OCRResult> {
  const res = await fetch(`${API}/infer/${imageId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function inferBatch(
  imageIds: string[],
  options: InferOptions = DEFAULT_INFER_OPTIONS
): Promise<OCRResult[]> {
  const res = await fetch(`${API}/infer/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_ids: imageIds, ...options }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getStatus(imageId: string): Promise<{ image_id: string; status: string }> {
  const res = await fetch(`${API}/status/${imageId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function downloadAnnotated(imageId: string, filename: string): Promise<void> {
  const res = await fetch(annotatedExportUrl(imageId));
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".png") ? filename : `${filename}_annotated.png`;
  a.click();
  URL.revokeObjectURL(url);
}
