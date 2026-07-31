const ACCEPTED_EXT = new Set([
  "png", "jpg", "jpeg", "jfif", "bmp", "gif", "webp", "avif", "tif", "tiff",
  "ico", "ppm", "pnm",
]);
const BROWSER_PREVIEW_EXT = new Set([
  "png", "jpg", "jpeg", "jfif", "bmp", "gif", "webp", "avif",
]);

export function fileExt(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function isAcceptedFile(file: File) {
  const ext = fileExt(file.name);
  return Boolean((ext && ACCEPTED_EXT.has(ext)) || file.type.startsWith("image/"));
}

export function needsServerPreview(file: File) {
  const ext = fileExt(file.name);
  if (ext && !BROWSER_PREVIEW_EXT.has(ext)) return true;
  return file.type === "image/tiff" || file.type === "image/x-icon";
}
