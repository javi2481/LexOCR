import { describe, expect, it } from "vitest";
import { groupImages } from "./documentGroups";
import type { ImageItem } from "../types/ocr";

function fakeFile(name: string): File {
  return new File([""], name, { type: "application/pdf" });
}

function item(partial: Partial<ImageItem> & Pick<ImageItem, "localId" | "groupId" | "filename">): ImageItem {
  return {
    status: "pending",
    previewUrl: "",
    file: fakeFile(partial.filename),
    ...partial,
  };
}

describe("groupImages", () => {
  it("keeps two uploads with the same filename as distinct groups", () => {
    const a = item({
      localId: "a1",
      groupId: "g-upload-1",
      filename: "report.pdf",
      page_index: 0,
    });
    const a2 = item({
      localId: "a2",
      groupId: "g-upload-1",
      filename: "report.pdf",
      page_index: 1,
    });
    const b = item({
      localId: "b1",
      groupId: "g-upload-2",
      filename: "report.pdf",
      page_index: 0,
    });

    const groups = groupImages([a, a2, b]);
    expect(groups).toHaveLength(2);
    expect(groups[0].groupId).toBe("g-upload-1");
    expect(groups[0].members.map((m) => m.localId)).toEqual(["a1", "a2"]);
    expect(groups[1].groupId).toBe("g-upload-2");
    expect(groups[1].members).toHaveLength(1);
  });

  it("sorts pages by page_index within a group", () => {
    const p2 = item({ localId: "2", groupId: "g", filename: "x.pdf", page_index: 2 });
    const p0 = item({ localId: "0", groupId: "g", filename: "x.pdf", page_index: 0 });
    const p1 = item({ localId: "1", groupId: "g", filename: "x.pdf", page_index: 1 });
    const groups = groupImages([p2, p0, p1]);
    expect(groups[0].members.map((m) => m.page_index)).toEqual([0, 1, 2]);
  });
});
