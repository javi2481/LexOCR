import type { ExportFormat } from "./exportResult";
import { downloadBlob } from "./exportResult";
import type { ConsolidatedDocument } from "./consolidate";

export type ExportDocumentOptions = {
  filename: string;
  consolidated: ConsolidatedDocument;
};

export function exportDocument(
  format: ExportFormat,
  { filename, consolidated }: ExportDocumentOptions,
) {
  const base = filename.replace(/\.[^.]+$/, "") || "document";
  const { cleanText, pages, metrics } = consolidated;

  if (format === "json") {
    const payload = {
      document: filename,
      metrics,
      processedCount: consolidated.processedCount,
      totalCount: consolidated.totalCount,
      isComplete: consolidated.isComplete,
      pages: pages.map((page) => ({
        page_index: page.pageIndex,
        filename: page.result.filename,
        confidence_avg: page.result.confidence_avg,
        regions_count: page.result.regions_count,
        low_confidence_count: page.result.low_confidence_count,
        ocr_tier: page.result.ocr_tier ?? "medium",
        regions: page.orderedRegions.map((r, i) => ({
          ...r,
          orientation: r.orientation ?? 0,
          reading_order: i,
        })),
      })),
      cleanText,
    };
    downloadBlob(`${base}.json`, JSON.stringify(payload, null, 2), "application/json");
    return;
  }

  if (format === "md") {
    const lines = [
      "---",
      `filename: ${filename}`,
      `pages: ${consolidated.totalCount}`,
      `processed: ${consolidated.processedCount}`,
      `regions_count: ${metrics.regions_count}`,
      `confidence_avg: ${metrics.confidence_avg}`,
      `low_confidence_count: ${metrics.regions_to_review}`,
      `pages_with_low: ${metrics.pages_with_low}`,
      "---",
      "",
      "# Texto limpio",
      "",
      cleanText || "_(sin texto)_",
      "",
    ];
    downloadBlob(`${base}.md`, lines.join("\n"), "text/markdown");
    return;
  }

  if (format === "csv") {
    const rows = [
      [
        "page_index",
        "id",
        "reading_order",
        "text",
        "confidence",
        "orientation",
        "x",
        "y",
        "width",
        "height",
      ],
      ...pages.flatMap((page) =>
        page.orderedRegions.map((r, i) => [
          page.pageIndex,
          r.id,
          i,
          `"${r.text.replace(/"/g, '""')}"`,
          r.confidence,
          r.orientation ?? 0,
          r.bbox.x,
          r.bbox.y,
          r.bbox.width,
          r.bbox.height,
        ]),
      ),
    ];
    downloadBlob(`${base}.csv`, rows.map((row) => row.join(",")).join("\n"), "text/csv");
    return;
  }

  downloadBlob(`${base}.txt`, cleanText, "text/plain");
}
