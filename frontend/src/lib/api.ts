import type {
  HealthInfo,
  InferOptions,
  OCRResult,
  UploadResponse,
} from "../types/ocr";

export type {
  HealthInfo,
  InferOptions,
  OCRResult,
  Region,
  UploadResponse,
} from "../types/ocr";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8100";

export const DEFAULT_INFER_OPTIONS: InferOptions = {
  conf_threshold: 0.9,
  text_det_thresh: 0.2,
  text_det_box_thresh: 0.35,
  text_det_unclip_ratio: 2.0,
  text_det_limit_side_len: 1152,
  text_det_limit_type: "min",
};

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

export async function infer(
  imageId: string,
  options: InferOptions = DEFAULT_INFER_OPTIONS,
): Promise<OCRResult> {
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
  options: InferOptions = DEFAULT_INFER_OPTIONS,
): Promise<OCRResult[]> {
  const res = await fetch(`${API}/infer/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_ids: imageIds, ...options }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getStatus(
  imageId: string,
): Promise<{ image_id: string; status: string }> {
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
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
