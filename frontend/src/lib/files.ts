const ACCEPTED_EXT = new Set([
  "png", "jpg", "jpeg", "jfif", "bmp", "gif", "webp", "avif", "tif", "tiff",
  "ico", "ppm", "pnm", "pdf",
]);
const BROWSER_PREVIEW_EXT = new Set([
  "png", "jpg", "jpeg", "jfif", "bmp", "gif", "webp", "avif",
]);
const DOCUMENT_EXT = new Set(["pdf", "tif", "tiff"]);

export function fileExt(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function isAcceptedFile(file: File) {
  const ext = fileExt(file.name);
  return Boolean(
    (ext && ACCEPTED_EXT.has(ext)) ||
      file.type.startsWith("image/") ||
      file.type === "application/pdf",
  );
}

export function isDocumentFile(file: File) {
  const ext = fileExt(file.name);
  return DOCUMENT_EXT.has(ext) || file.type === "application/pdf";
}

export function needsServerPreview(file: File) {
  const ext = fileExt(file.name);
  if (ext && !BROWSER_PREVIEW_EXT.has(ext)) return true;
  return (
    file.type === "image/tiff" ||
    file.type === "image/x-icon" ||
    file.type === "application/pdf"
  );
}
