export type InferOptions = {
  conf_threshold: number;
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
  orientation?: number;
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
  ocr_mode?: string;
  ocr_tier?: string;
  conf_threshold?: number;
  page_index?: number | null;
  page_count?: number | null;
  source_format?: string | null;
};

export type UploadPage = {
  image_id: string;
  page_index: number;
  page_count: number;
  filename: string;
  status: string;
  preview_url?: string;
  source_format?: string;
  result?: OCRResult;
};

export type UploadResponse = {
  image_id: string;
  filename: string;
  preview_url?: string;
  source_format?: string;
  page_count?: number;
  pages?: UploadPage[];
};

export type HealthInfo = {
  ok: boolean;
  cuda_compiled: boolean;
  device: string;
  engines_cached?: number;
};

export type Status = "pending" | "processing" | "completed" | "error";
export type ViewMode = "original" | "boxes" | "text";

export type ImageItem = {
  localId: string;
  id?: string;
  filename: string;
  status: Status;
  previewUrl: string;
  file: File;
  result?: OCRResult;
  error?: string;
  revokePreview?: boolean;
  page_index?: number;
  page_count?: number;
  source_format?: string;
};
