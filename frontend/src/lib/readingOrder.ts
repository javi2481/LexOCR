import type { Region } from "../types/ocr";

/** Orden de lectura aproximado: agrupa por línea (Y) y ordena por X. */
export function orderRegions(regions: Region[]): Region[] {
  if (!regions.length) return [];
  const ordered = [...regions].sort((a, b) => {
    const lineTolerance = Math.max(a.bbox.height, b.bbox.height) * 0.6;
    return Math.abs(a.bbox.y - b.bbox.y) <= lineTolerance
      ? a.bbox.x - b.bbox.x
      : a.bbox.y - b.bbox.y;
  });
  const lines: Region[][] = [];
  for (const region of ordered) {
    const current = lines.at(-1);
    if (!current) {
      lines.push([region]);
      continue;
    }
    const avgY = current.reduce((sum, item) => sum + item.bbox.y, 0) / current.length;
    const avgHeight =
      current.reduce((sum, item) => sum + item.bbox.height, 0) / current.length;
    if (Math.abs(region.bbox.y - avgY) <= Math.max(avgHeight, region.bbox.height) * 0.6) {
      current.push(region);
    } else {
      lines.push([region]);
    }
  }
  return lines.flatMap((line) => line.sort((a, b) => a.bbox.x - b.bbox.x));
}
