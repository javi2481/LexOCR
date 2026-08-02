import { describe, expect, it } from "vitest";
import { orderRegions } from "./readingOrder";
import type { Region } from "../types/ocr";

function r(id: number, x: number, y: number, h = 10): Region {
  return {
    id,
    text: `r${id}`,
    confidence: 0.9,
    bbox: { x, y, width: 20, height: h },
  };
}

describe("orderRegions", () => {
  it("orders left-to-right within a line and top-to-bottom across lines", () => {
    const regions = [r(1, 50, 0), r(0, 0, 0), r(2, 0, 40)];
    const ordered = orderRegions(regions);
    expect(ordered.map((x) => x.id)).toEqual([0, 1, 2]);
  });
});
