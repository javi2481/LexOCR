const API = import.meta.env.VITE_API_URL ?? "http://localhost:8100";

export type Region = {
  id: number;
  text: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
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
};

export type UploadResponse = {
  image_id: string;
  filename: string;
  preview_url?: string;
  source_format?: string;
};

export const imageUrl = (imageId: string) => `${API}/image/${imageId}`;

export async function upload(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function infer(imageId: string): Promise<OCRResult> {
  const res = await fetch(`${API}/infer/${imageId}`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function inferBatch(imageIds: string[]): Promise<OCRResult[]> {
  const res = await fetch(`${API}/infer/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_ids: imageIds }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getStatus(imageId: string): Promise<{ image_id: string; status: string }> {
  const res = await fetch(`${API}/status/${imageId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
