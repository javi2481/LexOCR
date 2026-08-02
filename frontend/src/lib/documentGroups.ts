import type { ImageItem } from "../types/ocr";

export type DocumentGroup = {
  groupId: string;
  label: string;
  members: ImageItem[];
};

/** Group flat ImageItem[] by groupId, preserving first-seen order. Pages sorted by page_index. */
export function groupImages(images: ImageItem[]): DocumentGroup[] {
  const order: string[] = [];
  const map = new Map<string, ImageItem[]>();

  for (const item of images) {
    const key = item.groupId;
    if (!map.has(key)) {
      order.push(key);
      map.set(key, []);
    }
    map.get(key)!.push(item);
  }

  return order.map((groupId) => {
    const members = [...map.get(groupId)!].sort(
      (a, b) => (a.page_index ?? 0) - (b.page_index ?? 0),
    );
    return {
      groupId,
      label: members[0]?.filename ?? groupId,
      members,
    };
  });
}

export function findActiveGroup(
  groups: DocumentGroup[],
  selectedId: string | null,
): DocumentGroup | null {
  if (!selectedId) return null;
  return groups.find((g) => g.members.some((m) => m.localId === selectedId)) ?? null;
}

export function isMultipageGroup(group: DocumentGroup | null): boolean {
  return (group?.members.length ?? 0) > 1;
}
