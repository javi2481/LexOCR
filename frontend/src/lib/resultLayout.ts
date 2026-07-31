import type { Region } from "../types/ocr";

export const PALETTE = [
  "#6366f1",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#06b6d4",
  "#f97316",
  "#ec4899",
];

const textWidthPerEmCache = new Map<string, number>();
let textMeasureContext: CanvasRenderingContext2D | null = null;

export type OrientedRegion = {
  id: number;
  text: string;
  confidence: number;
  poly: number[][];
  cx: number;
  cy: number;
  angleDeg: number;
  textWidth: number;
  textHeight: number;
  labelX: number;
  labelY: number;
};

export function confColor(c: number, threshold = 0.9) {
  if (c >= threshold) return "var(--success)";
  if (c >= threshold * 0.78) return "var(--warning)";
  return "var(--error)";
}

export function polyPointsAttr(poly: number[][], scaleX: number, scaleY: number): string {
  return poly.map((p) => `${p[0] * scaleX},${p[1] * scaleY}`).join(" ");
}

export function textWidthPerEm(text: string): number {
  const cached = textWidthPerEmCache.get(text);
  if (cached !== undefined) return cached;
  if (!textMeasureContext) {
    textMeasureContext = document.createElement("canvas").getContext("2d");
  }
  const measurementFontSize = 100;
  if (textMeasureContext) {
    textMeasureContext.font = `${measurementFontSize}px system-ui, sans-serif`;
  }
  const width =
    (textMeasureContext?.measureText(text).width ?? text.length * measurementFontSize * 0.6) /
    measurementFontSize;
  textWidthPerEmCache.set(text, width);
  return width;
}

export function regionFromPoly(r: Region): OrientedRegion {
  const poly =
    Array.isArray(r.poly) && r.poly.length >= 2
      ? r.poly
      : [
          [r.bbox.x, r.bbox.y],
          [r.bbox.x + r.bbox.width, r.bbox.y],
          [r.bbox.x + r.bbox.width, r.bbox.y + r.bbox.height],
          [r.bbox.x, r.bbox.y + r.bbox.height],
        ];
  const p0 = poly[0];
  const p1 = poly[1] ?? poly[0];
  const p3 = poly[3] ?? poly[poly.length - 1] ?? poly[0];
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const edgeWidth = Math.hypot(dx, dy) || Math.max(r.bbox.width, 1);
  const edgeHeight =
    Math.hypot(p3[0] - p0[0], p3[1] - p0[1]) || Math.max(r.bbox.height, 1);
  const orientation = r.orientation ?? 0;
  const polyAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const angleDeg = orientation !== 0 ? orientation : polyAngle;
  const vertical = Math.abs(Math.abs(orientation) - 90) < 1;
  let cx = 0;
  let cy = 0;
  for (const p of poly) {
    cx += p[0];
    cy += p[1];
  }
  cx /= poly.length;
  cy /= poly.length;
  return {
    id: r.id,
    text: r.text,
    confidence: r.confidence,
    poly,
    cx,
    cy,
    angleDeg,
    textWidth: vertical ? edgeHeight : edgeWidth,
    textHeight: vertical ? edgeWidth : edgeHeight,
    labelX: r.bbox.x + r.bbox.width,
    labelY: r.bbox.y,
  };
}

export function buildResultLayout(regions: Region[], imgW: number, imgH: number) {
  return {
    regions: regions.map(regionFromPoly),
    canvasW: Math.max(imgW, 1),
    canvasH: Math.max(imgH, 1),
  };
}
