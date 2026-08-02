import type { ImageItem, OCRResult, Region } from "../types/ocr";
import { orderRegions } from "./readingOrder";

export type ConsolidatedPage = {
  localId: string;
  pageIndex: number;
  pageLabel: string;
  result: OCRResult;
  orderedRegions: Region[];
  cleanText: string;
};

export type DocumentMetrics = {
  confidence_avg: number;
  regions_count: number;
  regions_to_review: number;
  pages_with_low: number;
};

export type ConsolidatedDocument = {
  cleanText: string;
  pages: ConsolidatedPage[];
  metrics: DocumentMetrics;
  processedCount: number;
  totalCount: number;
  isComplete: boolean;
};

function pageLabel(item: ImageItem): string {
  const n = (item.page_index ?? 0) + 1;
  return `página ${n}`;
}

/** Pure: concatenate ready pages in reading order; honest about partials. */
export function consolidate(members: ImageItem[]): ConsolidatedDocument {
  const totalCount = members.length;
  const ready = members.filter((m) => m.result);
  const pages: ConsolidatedPage[] = ready.map((item) => {
    const result = item.result!;
    const orderedRegions = orderRegions(result.regions);
    const cleanText = orderedRegions
      .map((r) => r.text.trim())
      .filter(Boolean)
      .join("\n");
    return {
      localId: item.localId,
      pageIndex: item.page_index ?? 0,
      pageLabel: pageLabel(item),
      result,
      orderedRegions,
      cleanText,
    };
  });

  const blocks: string[] = [];
  for (const page of pages) {
    blocks.push(`--- ${page.pageLabel} ---`);
    if (page.cleanText) blocks.push(page.cleanText);
  }

  let regionsSum = 0;
  let confWeighted = 0;
  let regions_to_review = 0;
  let pages_with_low = 0;
  for (const page of pages) {
    const n = page.result.regions_count;
    regionsSum += n;
    confWeighted += page.result.confidence_avg * n;
    regions_to_review += page.result.low_confidence_count;
    if (page.result.low_confidence_count > 0) pages_with_low += 1;
  }

  const allHaveResult = members.every((m) => !!m.result);
  const noneInError = members.every((m) => m.status !== "error");
  const isComplete = totalCount > 0 && allHaveResult && noneInError;

  return {
    cleanText: blocks.join("\n\n"),
    pages,
    metrics: {
      confidence_avg: regionsSum > 0 ? confWeighted / regionsSum : 0,
      regions_count: regionsSum,
      regions_to_review,
      pages_with_low,
    },
    processedCount: pages.length,
    totalCount,
    isComplete,
  };
}

/** Stable content signature for memoizing consolidate over a group. */
export function consolidateSignature(members: ImageItem[]): string {
  return members
    .map((m) => {
      if (!m.result) return `${m.localId}:${m.status}:x`;
      const body = m.result.regions
        .map((r) => `${r.id}:${r.text}:${r.confidence}`)
        .join(";");
      return `${m.localId}:${m.status}:${m.result.low_confidence_count}:${body}`;
    })
    .join("|");
}
