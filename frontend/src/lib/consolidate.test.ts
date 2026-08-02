import { describe, expect, it } from "vitest";
import { consolidate } from "./consolidate";
import type { ImageItem, OCRResult, Region } from "../types/ocr";

function region(id: number, text: string, confidence = 0.95): Region {
  return {
    id,
    text,
    confidence,
    bbox: { x: 0, y: id * 10, width: 40, height: 8 },
  };
}

function result(partial: Partial<OCRResult> & { regions: Region[] }): OCRResult {
  const { regions, ...rest } = partial;
  return {
    image_id: "img",
    filename: "doc.pdf",
    status: "completed",
    inference_time_ms: 100,
    confidence_avg: rest.confidence_avg ?? 0.9,
    regions_count: rest.regions_count ?? regions.length,
    low_confidence_count: rest.low_confidence_count ?? 0,
    regions,
    width: 100,
    height: 100,
    page_index: rest.page_index ?? 0,
    page_count: rest.page_count ?? 1,
    ...rest,
  };
}

function fakeFile(): File {
  return new File([""], "doc.pdf", { type: "application/pdf" });
}

function page(
  localId: string,
  page_index: number,
  res?: OCRResult,
  status: ImageItem["status"] = res ? "completed" : "pending",
): ImageItem {
  return {
    localId,
    groupId: "g1",
    filename: "doc.pdf",
    status,
    previewUrl: "",
    file: fakeFile(),
    page_index,
    page_count: 3,
    result: res,
  };
}

describe("consolidate", () => {
  it("uses region-weighted confidence average", () => {
    const small = result({
      page_index: 0,
      regions: [region(0, "a"), region(1, "b")],
      regions_count: 2,
      confidence_avg: 1.0,
    });
    const large = result({
      page_index: 1,
      regions: Array.from({ length: 200 }, (_, i) => region(i, `t${i}`)),
      regions_count: 200,
      confidence_avg: 0.5,
    });
    const doc = consolidate([
      page("p0", 0, small),
      page("p1", 1, large),
    ]);
    // (1.0*2 + 0.5*200) / 202 = 102/202
    expect(doc.metrics.confidence_avg).toBeCloseTo(102 / 202, 6);
  });

  it("reports partial progress and isComplete false until all pages have results", () => {
    const r0 = result({ page_index: 0, regions: [region(0, "hello")] });
    const members = [
      page("p0", 0, r0),
      page("p1", 1),
      page("p2", 2),
    ];
    const doc = consolidate(members);
    expect(doc.processedCount).toBe(1);
    expect(doc.totalCount).toBe(3);
    expect(doc.isComplete).toBe(false);
    expect(doc.cleanText).toContain("--- página 1 ---");
    expect(doc.cleanText).toContain("hello");
    expect(doc.cleanText).not.toContain("--- página 2 ---");
  });

  it("marks incomplete when a page is in error even if all have results", () => {
    const r0 = result({ page_index: 0, regions: [region(0, "ok")] });
    const r1 = result({ page_index: 1, regions: [region(0, "bad")] });
    const doc = consolidate([
      page("p0", 0, r0, "completed"),
      page("p1", 1, r1, "error"),
    ]);
    expect(doc.processedCount).toBe(2);
    expect(doc.isComplete).toBe(false);
  });

  it("isComplete when every page has a result and none are error", () => {
    const doc = consolidate([
      page("p0", 0, result({ page_index: 0, regions: [region(0, "a")] })),
      page("p1", 1, result({ page_index: 1, regions: [region(0, "b")] })),
    ]);
    expect(doc.isComplete).toBe(true);
    expect(doc.processedCount).toBe(2);
  });
});
