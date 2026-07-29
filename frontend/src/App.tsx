import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import {
  upload,
  infer,
  imageUrl,
  DEFAULT_INFER_OPTIONS,
  type InferOptions,
  type OcrMode,
  type OcrTier,
  type OCRResult,
  type Region,
} from "./api";

type Status = "pending" | "processing" | "completed" | "error";

type ImageItem = {
  localId: string;
  id?: string;
  filename: string;
  status: Status;
  previewUrl: string;
  file: File;
  result?: OCRResult;
  error?: string;
  revokePreview?: boolean;
};

const ACCEPTED_EXT = new Set([
  "png",
  "jpg",
  "jpeg",
  "jfif",
  "bmp",
  "gif",
  "webp",
  "avif",
  "tif",
  "tiff",
  "ico",
  "ppm",
  "pnm",
]);

const BROWSER_PREVIEW_EXT = new Set(["png", "jpg", "jpeg", "jfif", "bmp", "gif", "webp", "avif"]);

const OCR_LS_KEY = "ocr_options";

function loadOcrOptions(): InferOptions {
  try {
    const raw = localStorage.getItem(OCR_LS_KEY);
    if (!raw) return { ...DEFAULT_INFER_OPTIONS };
    const parsed = JSON.parse(raw) as Partial<InferOptions>;
    const mode: OcrMode = parsed.mode === "document" ? "document" : "fast";
    const tier: OcrTier =
      parsed.tier === "tiny" || parsed.tier === "small" || parsed.tier === "medium"
        ? parsed.tier
        : "medium";
    const thr =
      typeof parsed.conf_threshold === "number"
        ? Math.min(0.95, Math.max(0.5, parsed.conf_threshold))
        : 0.9;
    const opts: InferOptions = { mode, tier, conf_threshold: thr };
    // Passthrough opcional: solo si el usuario ya los guardó; sin inventar defaults
    if (typeof parsed.text_det_box_thresh === "number") {
      opts.text_det_box_thresh = parsed.text_det_box_thresh;
    }
    if (typeof parsed.text_det_thresh === "number") {
      opts.text_det_thresh = parsed.text_det_thresh;
    }
    if (typeof parsed.text_det_unclip_ratio === "number") {
      opts.text_det_unclip_ratio = parsed.text_det_unclip_ratio;
    }
    if (typeof parsed.text_det_limit_side_len === "number") {
      opts.text_det_limit_side_len = parsed.text_det_limit_side_len;
    }
    if (typeof parsed.text_det_limit_type === "string" && parsed.text_det_limit_type) {
      opts.text_det_limit_type = parsed.text_det_limit_type;
    }
    return opts;
  } catch {
    return { ...DEFAULT_INFER_OPTIONS };
  }
}

function fileExt(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function isAcceptedFile(f: File) {
  const ext = fileExt(f.name);
  if (ext && ACCEPTED_EXT.has(ext)) return true;
  if (f.type.startsWith("image/")) return true;
  return false;
}

function needsServerPreview(f: File) {
  const ext = fileExt(f.name);
  if (ext && !BROWSER_PREVIEW_EXT.has(ext)) return true;
  if (f.type === "image/tiff" || f.type === "image/x-icon") return true;
  return false;
}

const PALETTE = [
  "#6366f1",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#06b6d4",
  "#f97316",
  "#ec4899",
];

const STATUS_BORDER: Record<Status, string> = {
  pending: "var(--border)",
  processing: "var(--accent)",
  completed: "var(--success)",
  error: "var(--error)",
};

function IconSun() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5z" />
    </svg>
  );
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function confColor(c: number, threshold = 0.9) {
  if (c >= threshold) return "var(--success)";
  if (c >= threshold * 0.78) return "var(--warning)";
  return "var(--error)";
}

function polyPointsAttr(poly: number[][], scaleX: number, scaleY: number): string {
  return poly.map((p) => `${p[0] * scaleX},${p[1] * scaleY}`).join(" ");
}

/** Geometría de lectura desde el quad de Paddle (p0→p1 = línea de texto). */
type OrientedRegion = {
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

function regionFromPoly(r: Region): OrientedRegion {
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
  const textWidth = Math.hypot(dx, dy) || Math.max(r.bbox.width, 1);
  const textHeight =
    Math.hypot(p3[0] - p0[0], p3[1] - p0[1]) || Math.max(r.bbox.height, 1);
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

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
    textWidth,
    textHeight,
    labelX: r.bbox.x + r.bbox.width,
    labelY: r.bbox.y,
  };
}

function buildResultLayout(regions: Region[], imgW: number, imgH: number) {
  return {
    regions: regions.map(regionFromPoly),
    canvasW: Math.max(imgW, 1),
    canvasH: Math.max(imgH, 1),
  };
}

export default function App() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<"original" | "boxes">("boxes");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("theme");
    return saved === "light" ? "light" : "dark";
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "numbers">("all");
  const [ocrOptions, setOcrOptions] = useState<InferOptions>(() => loadOcrOptions());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const regionRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 1, h: 1 });
  const [displaySize, setDisplaySize] = useState({ w: 1, h: 1 });

  const selected = images.find((i) => i.localId === selectedId) ?? null;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(OCR_LS_KEY, JSON.stringify(ocrOptions));
  }, [ocrOptions]);

  useEffect(() => {
    const el = imgWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const img = el.querySelector("img");
      if (img) setDisplaySize({ w: img.clientWidth, h: img.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [selected?.previewUrl, zoom]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files).filter(isAcceptedFile);
    if (!list.length) return;

    const next: ImageItem[] = list.map((file) => {
      const localPreview = !needsServerPreview(file);
      return {
        localId: crypto.randomUUID(),
        filename: file.name,
        status: "pending" as const,
        previewUrl: localPreview ? URL.createObjectURL(file) : "",
        file,
        revokePreview: localPreview,
      };
    });

    setImages((prev) => [...prev, ...next]);
    setSelectedId((id) => id ?? next[0].localId);

    next
      .filter((item) => needsServerPreview(item.file))
      .forEach(async (item) => {
        try {
          const up = await upload(item.file);
          setImages((prev) =>
            prev.map((img) =>
              img.localId === item.localId
                ? {
                    ...img,
                    id: up.image_id,
                    previewUrl: imageUrl(up.image_id),
                    revokePreview: false,
                  }
                : img
            )
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Error al subir";
          setImages((prev) =>
            prev.map((img) =>
              img.localId === item.localId ? { ...img, status: "error", error: msg } : img
            )
          );
        }
      });
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (!item.type.startsWith("image/")) continue;
        const blob = item.getAsFile();
        if (!blob) continue;
        const ext = blob.type.split("/")[1] || "png";
        const name = `paste-${Date.now()}.${ext === "jpeg" ? "jpg" : ext}`;
        files.push(new File([blob], name, { type: blob.type }));
      }
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const updateImage = (localId: string, patch: Partial<ImageItem>) => {
    setImages((prev) => prev.map((img) => (img.localId === localId ? { ...img, ...patch } : img)));
  };

  const runOne = async (item: ImageItem) => {
    updateImage(item.localId, { status: "processing", error: undefined });
    try {
      let imageId = item.id;
      if (!imageId) {
        const up = await upload(item.file);
        imageId = up.image_id;
        if (item.revokePreview && item.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(item.previewUrl);
        }
        updateImage(item.localId, {
          id: imageId,
          previewUrl: imageUrl(imageId),
          revokePreview: false,
        });
      }
      const result = await infer(imageId, ocrOptions);
      updateImage(item.localId, { status: "completed", result, id: imageId });
      setLastMs(result.inference_time_ms);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      updateImage(item.localId, { status: "error", error: msg });
      throw err;
    }
  };

  const runSelected = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setProgress({ done: 0, total: 1 });
    try {
      await runOne(selected);
      setProgress({ done: 1, total: 1 });
    } finally {
      setBusy(false);
    }
  };

  const runAll = async () => {
    const pending = images.filter((i) => i.status === "pending" || i.status === "error");
    if (!pending.length || busy) return;
    setBusy(true);
    setProgress({ done: 0, total: pending.length });
    let done = 0;
    for (const item of pending) {
      const current = images.find((i) => i.localId === item.localId) ?? item;
      try {
        await runOne(current);
      } catch {
        /* continue */
      }
      done += 1;
      setProgress({ done, total: pending.length });
    }
    setBusy(false);
  };

  const clearAll = () => {
    images.forEach((i) => {
      if (i.revokePreview && i.previewUrl.startsWith("blob:")) URL.revokeObjectURL(i.previewUrl);
    });
    setImages([]);
    setSelectedId(null);
    setHoveredRegion(null);
    setProgress({ done: 0, total: 0 });
  };

  const removeOne = (localId: string) => {
    setImages((prev) => {
      const target = prev.find((i) => i.localId === localId);
      if (target?.revokePreview && target.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      const next = prev.filter((i) => i.localId !== localId);
      if (selectedId === localId) setSelectedId(next[0]?.localId ?? null);
      return next;
    });
  };

  const updateRegionText = (regionId: number, text: string) => {
    if (!selected?.result) return;
    const regions = selected.result.regions.map((r) =>
      r.id === regionId ? { ...r, text } : r
    );
    updateImage(selected.localId, {
      result: { ...selected.result, regions },
    });
  };

  const filteredRegions: Region[] = useMemo(() => {
    const regions = selected?.result?.regions ?? [];
    const thr = ocrOptions.conf_threshold;
    return regions.filter((r) => {
      if (filter === "low" && r.confidence >= thr) return false;
      if (filter === "numbers" && !/^\d/.test(r.text.trim())) return false;
      if (search && !r.text.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [selected?.result?.regions, filter, search, ocrOptions.conf_threshold]);

  const orderedRegions: Region[] = useMemo(() => {
    const regions = selected?.result?.regions ?? [];
    if (!regions.length) return [];

    const ordered = [...regions].sort((a, b) => {
      const lineTolerance = Math.max(a.bbox.height, b.bbox.height) * 0.6;
      if (Math.abs(a.bbox.y - b.bbox.y) <= lineTolerance) {
        return a.bbox.x - b.bbox.x;
      }
      return a.bbox.y - b.bbox.y;
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
  }, [selected?.result?.regions]);

  const resultLayout = useMemo(() => {
    if (!selected?.result) {
      return { regions: [] as OrientedRegion[], canvasW: 1, canvasH: 1 };
    }
    return buildResultLayout(
      selected.result.regions,
      selected.result.width,
      selected.result.height
    );
  }, [selected?.result]);

  const cleanText = useMemo(
    () =>
      orderedRegions
        .map((r) => r.text.trim())
        .filter(Boolean)
        .join("\n"),
    [orderedRegions]
  );

  const copyCleanText = async () => {
    if (!cleanText) return;
    await navigator.clipboard.writeText(cleanText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const exportResult = (format: "json" | "csv" | "txt") => {
    if (!selected?.result) return;
    const res = selected.result;
    const base = selected.filename.replace(/\.[^.]+$/, "") || "ocr";
    if (format === "json") {
      downloadBlob(`${base}.json`, JSON.stringify(res, null, 2), "application/json");
      return;
    }
    if (format === "csv") {
      const rows = [
        ["id", "text", "confidence", "x", "y", "width", "height"],
        ...res.regions.map((r) => [
          r.id,
          `"${r.text.replace(/"/g, '""')}"`,
          r.confidence,
          r.bbox.x,
          r.bbox.y,
          r.bbox.width,
          r.bbox.height,
        ]),
      ];
      downloadBlob(`${base}.csv`, rows.map((r) => r.join(",")).join("\n"), "text/csv");
      return;
    }
    downloadBlob(`${base}.txt`, res.regions.map((r) => r.text).join("\n"), "text/plain");
  };

  const scaleX = displaySize.w / naturalSize.w;
  const scaleY = displaySize.h / naturalSize.h;

  const scrollToRegion = (id: number) => {
    setHoveredRegion(id);
    regionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <header
        className="flex h-12 shrink-0 items-center justify-between border-b px-4"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white"
            style={{ background: "var(--accent)" }}
          >
            IDP
          </div>
          <span className="text-sm font-semibold tracking-wide">IDP OCR Studio</span>
          <span
            className="rounded px-2 py-0.5 text-[10px] font-medium uppercase"
            style={{
              background: "var(--surface-raised)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
            title="Motor y opciones activas"
          >
            PP-OCRv6 · {selected?.result?.ocr_tier ?? ocrOptions.tier} ·{" "}
            {selected?.result?.ocr_mode ?? ocrOptions.mode}
          </span>
          <div className="ml-1 flex flex-wrap items-center gap-2" role="group" aria-label="Opciones OCR">
            <div className="flex rounded border" style={{ borderColor: "var(--border)" }}>
              {(
                [
                  ["fast", "Rápido"],
                  ["document", "Documento"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={busy}
                  aria-pressed={ocrOptions.mode === value}
                  aria-label={`Modo ${label}`}
                  onClick={() => setOcrOptions((o) => ({ ...o, mode: value }))}
                  className="px-2 py-1 text-[10px] font-medium disabled:opacity-50"
                  style={{
                    background:
                      ocrOptions.mode === value ? "var(--accent)" : "var(--surface-raised)",
                    color: ocrOptions.mode === value ? "#fff" : "var(--text-secondary)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-secondary)" }}>
              <span>Tier</span>
              <select
                aria-label="Tier del modelo"
                disabled={busy}
                value={ocrOptions.tier}
                onChange={(e) =>
                  setOcrOptions((o) => ({ ...o, tier: e.target.value as OcrTier }))
                }
                className="rounded border px-1 py-0.5 text-[10px] disabled:opacity-50"
                style={{
                  background: "var(--surface-raised)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              >
                <option value="tiny">tiny</option>
                <option value="small">small</option>
                <option value="medium">medium</option>
              </select>
            </label>
            <label className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-secondary)" }}>
              <span>Conf {(ocrOptions.conf_threshold * 100).toFixed(0)}%</span>
              <input
                type="range"
                min={0.5}
                max={0.95}
                step={0.05}
                aria-label="Umbral de baja confianza"
                disabled={busy}
                value={ocrOptions.conf_threshold}
                onChange={(e) =>
                  setOcrOptions((o) => ({
                    ...o,
                    conf_threshold: Number(e.target.value),
                  }))
                }
                className="w-20 disabled:opacity-50"
              />
            </label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(["json", "csv", "txt"] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                disabled={!selected?.result}
                onClick={() => exportResult(fmt)}
                className="rounded px-2 py-1 text-xs uppercase disabled:opacity-40"
                style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
              >
                {fmt}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="rounded p-1.5"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
            aria-label="Cambiar tema"
          >
            {theme === "dark" ? <IconSun /> : <IconMoon />}
          </button>
        </div>
      </header>

      {/* Main grid */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_minmax(380px,1fr)]">
        {/* Gallery */}
        <aside
          className="flex min-h-0 flex-col border-r"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div
            className="m-3 cursor-pointer rounded-lg border-2 border-dashed p-4 text-center text-xs transition-colors"
            style={{
              borderColor: dragOver ? "var(--accent)" : "var(--border)",
              background: dragOver ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-raised)",
              color: "var(--text-secondary)",
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            Arrastrá imágenes o pegá (Ctrl+V)
            <div className="mt-1 text-[10px] opacity-70">PNG JPG WEBP AVIF TIFF GIF BMP ICO PPM</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.jfif,.bmp,.gif,.webp,.avif,.tif,.tiff,.ico,.ppm,.pnm,image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </div>

          <div className="shrink-0 px-3 pb-3">
            <div className="grid grid-cols-2 gap-2">
              {images.map((img) => (
                <button
                  key={img.localId}
                  type="button"
                  onClick={() => setSelectedId(img.localId)}
                  onDoubleClick={() => removeOne(img.localId)}
                  className="group relative overflow-hidden rounded-md text-left"
                  style={{
                    border: `2px solid ${selectedId === img.localId ? "var(--accent)" : STATUS_BORDER[img.status]}`,
                    background: "var(--bg)",
                  }}
                  title={`${img.filename} (${img.status}) — doble click para quitar`}
                >
                  <img src={img.previewUrl} alt={img.filename} className="aspect-square w-full object-cover" />
                  <div
                    className="truncate px-1 py-0.5 text-[10px]"
                    style={{ background: "var(--surface-raised)", color: "var(--text-secondary)" }}
                  >
                    {img.filename}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col border-t" style={{ borderColor: "var(--border)" }}>
            <div className="space-y-2 p-3">
              <div className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                Palabras detectadas
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar palabra…"
                className="w-full rounded-md px-2 py-1.5 text-xs outline-none"
                style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
              />
              <div className="flex gap-1">
                {([
                  ["all", "Todas"],
                  ["low", "Baja conf."],
                  ["numbers", "Números"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className="rounded px-2 py-1 text-[10px]"
                    style={{
                      ...btnStyle,
                      outline: filter === key ? "1px solid var(--accent)" : undefined,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
              {!selected?.result && (
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {selected?.status === "error"
                    ? selected.error || "Error en inferencia"
                    : "Sin resultados aún. Ejecutá Run."}
                </p>
              )}
              {filteredRegions.map((r) => {
                const color = PALETTE[r.id % PALETTE.length];
                const active = hoveredRegion === r.id;
                return (
                  <div
                    key={r.id}
                    ref={(el) => {
                      regionRefs.current[r.id] = el;
                    }}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5"
                    style={{
                      background: active ? "var(--surface-raised)" : "transparent",
                      border: `1px solid ${active ? color : "transparent"}`,
                    }}
                    onMouseEnter={() => setHoveredRegion(r.id)}
                    onMouseLeave={() => setHoveredRegion(null)}
                    onClick={() => scrollToRegion(r.id)}
                  >
                    <span className="w-7 shrink-0 text-[10px]" style={{ color }}>#{r.id}</span>
                    <input
                      value={r.text}
                      onChange={(e) => updateRegionText(r.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                      style={{ color: "var(--text)" }}
                    />
                    <span
                      className="shrink-0 text-[10px]"
                      style={{ color: confColor(r.confidence, ocrOptions.conf_threshold) }}
                    >
                      {(r.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 border-t p-3" style={{ borderColor: "var(--border)" }}>
            <button
              type="button"
              disabled={busy || !selected}
              onClick={runSelected}
              className="flex-1 rounded-md px-2 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              style={{ background: "var(--accent)" }}
            >
              Run
            </button>
            <button
              type="button"
              disabled={busy || !images.some((i) => i.status === "pending" || i.status === "error")}
              onClick={runAll}
              className="flex-1 rounded-md px-2 py-1.5 text-xs font-medium disabled:opacity-40"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
            >
              Run All
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="rounded-md px-2 py-1.5 text-xs disabled:opacity-40"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", color: "var(--error)" }}
            >
              Clear
            </button>
          </div>
        </aside>

        {/* Viewer */}
        <main className="flex min-h-0 flex-col" style={{ background: "var(--bg)" }}>
          <div
            className="flex h-12 shrink-0 items-center justify-center border-b text-sm font-semibold"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            Input Image
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
            {selected ? (
              <div
                ref={imgWrapRef}
                className="relative inline-block origin-center"
                style={{ transform: `scale(${zoom})` }}
              >
                <img
                  src={selected.previewUrl}
                  alt={selected.filename}
                  className="max-h-[70vh] max-w-full"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
                    setDisplaySize({ w: img.clientWidth, h: img.clientHeight });
                  }}
                />
                {viewMode === "boxes" && selected.result && (
                  <svg
                    className="absolute left-0 top-0"
                    width={displaySize.w}
                    height={displaySize.h}
                    style={{ pointerEvents: "auto" }}
                  >
                    {selected.result.regions.map((r, i) => {
                      const color = PALETTE[i % PALETTE.length];
                      const active = hoveredRegion === r.id;
                      const hasPoly = Array.isArray(r.poly) && r.poly.length >= 3;
                      return (
                        <g
                          key={r.id}
                          onMouseEnter={() => setHoveredRegion(r.id)}
                          onMouseLeave={() => setHoveredRegion(null)}
                          onClick={() => scrollToRegion(r.id)}
                          style={{ cursor: "pointer" }}
                        >
                          {hasPoly ? (
                            <polygon
                              points={polyPointsAttr(r.poly!, scaleX, scaleY)}
                              stroke={color}
                              strokeWidth={active ? 3 : 2}
                              fill={color}
                              fillOpacity={active ? 0.18 : 0.06}
                            />
                          ) : (
                            <rect
                              x={r.bbox.x * scaleX}
                              y={r.bbox.y * scaleY}
                              width={r.bbox.width * scaleX}
                              height={r.bbox.height * scaleY}
                              stroke={color}
                              strokeWidth={active ? 3 : 2}
                              fill={color}
                              fillOpacity={active ? 0.18 : 0.06}
                              rx={3}
                            />
                          )}
                          <text
                            x={r.bbox.x * scaleX}
                            y={r.bbox.y * scaleY - 4}
                            fill={color}
                            fontSize={11}
                            fontWeight={600}
                          >
                            #{r.id} · {(r.confidence * 100).toFixed(0)}%
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                )}
                {selected.status === "processing" && (
                  <div
                    className="absolute inset-0 flex items-center justify-center text-sm"
                    style={{ background: "color-mix(in srgb, var(--bg) 70%, transparent)" }}
                  >
                    Procesando…
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Subí una imagen para comenzar
              </p>
            )}
          </div>

          <div
            className="flex flex-wrap items-center gap-2 border-t px-3 py-2"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <button type="button" className="rounded px-2 py-1 text-xs" style={btnStyle} onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>
              −
            </button>
            <button type="button" className="rounded px-2 py-1 text-xs" style={btnStyle} onClick={() => setZoom(1)}>
              {Math.round(zoom * 100)}%
            </button>
            <button type="button" className="rounded px-2 py-1 text-xs" style={btnStyle} onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
              +
            </button>
            <button type="button" className="rounded px-2 py-1 text-xs" style={btnStyle} onClick={() => setZoom(1)}>
              Fit
            </button>
            <div className="ml-2 flex gap-1">
              <button
                type="button"
                className="rounded px-2 py-1 text-xs"
                style={{ ...btnStyle, outline: viewMode === "original" ? "1px solid var(--accent)" : undefined }}
                onClick={() => setViewMode("original")}
              >
                Original
              </button>
              <button
                type="button"
                className="rounded px-2 py-1 text-xs"
                style={{ ...btnStyle, outline: viewMode === "boxes" ? "1px solid var(--accent)" : undefined }}
                onClick={() => setViewMode("boxes")}
              >
                BB
              </button>
            </div>
          </div>
        </main>

        {/* Results */}
        <aside
          className="flex min-h-0 flex-col border-l"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div
            className="flex h-12 shrink-0 items-center justify-between border-b px-3"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex-1 text-center text-sm font-semibold">Result Text</div>
            <button
              type="button"
              disabled={!cleanText}
              onClick={copyCleanText}
              className="rounded-md px-2.5 py-1.5 text-xs disabled:opacity-40"
              style={btnStyle}
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
            {!selected?.result ? (
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {selected?.status === "error"
                  ? selected.error || "Error en inferencia"
                  : "Sin resultados aún. Ejecutá Run."}
              </p>
            ) : (
              <svg
                viewBox={`0 0 ${resultLayout.canvasW} ${resultLayout.canvasH}`}
                className="max-h-full w-full border bg-white shadow-sm"
                style={{ borderColor: "var(--border)" }}
                role="img"
                aria-label="ResultText"
              >
                {resultLayout.regions.map((r, i) => {
                  const color = PALETTE[i % PALETTE.length];
                  const active = hoveredRegion === r.id;
                  const fontSize = Math.max(r.textHeight * 0.85, 1);
                  const labelSize = Math.max(Math.min(r.textHeight * 0.35, 14), 8);
                  return (
                    <g
                      key={r.id}
                      onMouseEnter={() => setHoveredRegion(r.id)}
                      onMouseLeave={() => setHoveredRegion(null)}
                      onClick={() => scrollToRegion(r.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <polygon
                        points={polyPointsAttr(r.poly, 1, 1)}
                        fill={active ? `${color}18` : "none"}
                        stroke={color}
                        strokeWidth={active ? 2.5 : 1.5}
                      />
                      <text
                        x={0}
                        y={0}
                        fill="#111827"
                        fontSize={fontSize}
                        fontFamily="system-ui, sans-serif"
                        textAnchor="middle"
                        dominantBaseline="central"
                        textLength={Math.max(r.textWidth, 1)}
                        lengthAdjust="spacingAndGlyphs"
                        transform={`translate(${r.cx} ${r.cy}) rotate(${r.angleDeg})`}
                      >
                        {r.text}
                      </text>
                      <text
                        x={r.labelX}
                        y={Math.max(r.labelY - 2, labelSize)}
                        fill={confColor(r.confidence, ocrOptions.conf_threshold)}
                        fontSize={labelSize}
                        fontWeight={600}
                        textAnchor="end"
                        fontFamily="system-ui, sans-serif"
                      >
                        {(r.confidence * 100).toFixed(0)}%
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>

          <div className="border-t p-3" style={{ borderColor: "var(--border)" }}>
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
              Métricas
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Metric
                value={selected?.result ? `${(selected.result.confidence_avg * 100).toFixed(1)}%` : "—"}
                label="Confianza avg"
              />
              <Metric
                value={selected?.result ? `${(selected.result.inference_time_ms / 1000).toFixed(2)}s` : "—"}
                label="Tiempo"
              />
              <Metric value={selected?.result ? String(selected.result.regions_count) : "—"} label="Regiones" />
              <Metric
                value={selected?.result ? String(selected.result.low_confidence_count) : "—"}
                label="Baja conf."
              />
            </div>
          </div>
        </aside>
      </div>

      {/* Status bar */}
      <footer
        className="flex h-8 shrink-0 items-center gap-4 border-t px-4 text-[11px]"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }}
      >
        <span>
          {busy
            ? `Procesando ${progress.done}/${progress.total}`
            : images.length
              ? `${images.filter((i) => i.status === "completed").length}/${images.length} completadas`
              : "Listo"}
        </span>
        <span>Última: {lastMs != null ? `${(lastMs / 1000).toFixed(2)}s` : "—"}</span>
        <span className="ml-auto">{images.length} imágenes</span>
      </footer>
    </div>
  );
}

const btnStyle: CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--border)",
  color: "var(--text)",
};

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg p-2.5" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
      <div className="text-lg font-medium leading-tight">{value}</div>
      <div className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
    </div>
  );
}
