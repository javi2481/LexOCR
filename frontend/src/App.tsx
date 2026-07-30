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
  inferBatch,
  imageUrl,
  getHealth,
  downloadAnnotated,
  DEFAULT_INFER_OPTIONS,
  type InferOptions,
  type OcrTier,
  type OCRResult,
  type Region,
  type HealthInfo,
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
    const tier: OcrTier =
      parsed.tier === "tiny" || parsed.tier === "small" || parsed.tier === "medium"
        ? parsed.tier
        : "medium";
    // Solo se expone Tier en UI; resto = defaults de producto / Paddle
    return { ...DEFAULT_INFER_OPTIONS, tier };
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

const textWidthPerEmCache = new Map<string, number>();
let textMeasureContext: CanvasRenderingContext2D | null = null;

function textWidthPerEm(text: string): number {
  const cached = textWidthPerEmCache.get(text);
  if (cached !== undefined) return cached;

  if (!textMeasureContext) {
    textMeasureContext = document.createElement("canvas").getContext("2d");
  }

  const measurementFontSize = 100;
  if (textMeasureContext) {
    textMeasureContext.font = `${measurementFontSize}px system-ui, sans-serif`;
  }
  const width =
    (textMeasureContext?.measureText(text).width ?? text.length * measurementFontSize * 0.6) /
    measurementFontSize;
  textWidthPerEmCache.set(text, width);
  return width;
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
  const [ocrOptions, setOcrOptions] = useState<InferOptions>(() => loadOcrOptions());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wordsOpen, setWordsOpen] = useState(true);
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
    let cancelled = false;
    getHealth()
      .then((info) => {
        if (!cancelled) setHealth(info);
      })
      .catch(() => {
        if (!cancelled) setHealth(null);
      });
    const id = window.setInterval(() => {
      getHealth()
        .then((info) => {
          if (!cancelled) setHealth(info);
        })
        .catch(() => {
          /* keep last */
        });
    }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

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

    // Asegurar upload de las que aún no tienen id de servidor
    const ready: ImageItem[] = [];
    for (const item of pending) {
      const current = images.find((i) => i.localId === item.localId) ?? item;
      try {
        if (!current.id) {
          updateImage(current.localId, { status: "processing", error: undefined });
          const up = await upload(current.file);
          const previewUrl = current.revokePreview
            ? imageUrl(up.image_id)
            : current.previewUrl;
          if (current.revokePreview && current.previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(current.previewUrl);
          }
          const updated: ImageItem = {
            ...current,
            id: up.image_id,
            previewUrl,
            revokePreview: false,
            status: "processing",
          };
          updateImage(current.localId, updated);
          ready.push(updated);
        } else {
          updateImage(current.localId, { status: "processing", error: undefined });
          ready.push({ ...current, status: "processing" });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error";
        updateImage(current.localId, { status: "error", error: msg });
      }
    }

    const ids = ready.map((r) => r.id!).filter(Boolean);
    try {
      if (ids.length) {
        const results = await inferBatch(ids, ocrOptions);
        const byId = new Map(results.map((r) => [r.image_id, r]));
        for (const item of ready) {
          const result = item.id ? byId.get(item.id) : undefined;
          if (result) {
            updateImage(item.localId, { status: "completed", result, id: item.id });
            setLastMs(result.inference_time_ms);
          } else if (item.id) {
            // Fallback individual si el batch omitió el id
            try {
              await runOne(item);
            } catch {
              /* continue */
            }
          }
        }
      }
    } catch {
      // Si /infer/batch falla, fallback secuencial
      for (const item of ready) {
        try {
          await runOne(item);
        } catch {
          /* continue */
        }
      }
    }

    setProgress({ done: pending.length, total: pending.length });
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

  const trayRegions: Region[] = selected?.result?.regions ?? [];

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

  const openFilePicker = () => fileInputRef.current?.click();

  const dropHandlers = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop,
  };

  const emptyDropStyle: CSSProperties = {
    borderColor: dragOver ? "var(--accent)" : "var(--border)",
    background: dragOver
      ? "color-mix(in srgb, var(--accent) 12%, transparent)"
      : "var(--surface)",
  };

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.jfif,.bmp,.gif,.webp,.avif,.tif,.tiff,.ico,.ppm,.pnm,image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && addFiles(e.target.files)}
      />

      {/* Toolbar — acciones globales */}
      <header
        className="flex h-12 shrink-0 flex-wrap items-center gap-2 border-b px-3"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="flex items-center gap-2">
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
            title="Motor y tier activos"
          >
            PP-OCRv6 · {selected?.result?.ocr_tier ?? ocrOptions.tier}
          </span>
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
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex gap-1" role="group" aria-label="Acciones de sesión">
            <button
              type="button"
              disabled={busy || !selected}
              onClick={runSelected}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
              style={{ background: "var(--accent)" }}
            >
              Run
            </button>
            <button
              type="button"
              disabled={busy || !images.some((i) => i.status === "pending" || i.status === "error")}
              onClick={runAll}
              className="rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-40"
              style={btnStyle}
            >
              Run All
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="rounded-md px-2.5 py-1 text-xs disabled:opacity-40"
              style={{ ...btnStyle, color: "var(--error)" }}
            >
              Clear
            </button>
          </div>
          <div className="flex gap-1">
            {(["json", "csv", "txt"] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                disabled={!selected?.result}
                onClick={() => exportResult(fmt)}
                className="rounded px-2 py-1 text-xs uppercase disabled:opacity-40"
                style={btnStyle}
              >
                {fmt}
              </button>
            ))}
            <button
              type="button"
              disabled={!selected?.result?.image_id || busy}
              onClick={async () => {
                if (!selected?.result?.image_id) return;
                try {
                  await downloadAnnotated(
                    selected.result.image_id,
                    `${selected.filename || "image"}_annotated.png`
                  );
                } catch (err) {
                  console.error(err);
                }
              }}
              className="rounded px-2 py-1 text-xs uppercase disabled:opacity-40"
              style={btnStyle}
              title="PNG anotado vía save_to_img()"
            >
              png
            </button>
          </div>
          <button
            type="button"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="rounded p-1.5"
            style={btnStyle}
            aria-label="Cambiar tema"
          >
            {theme === "dark" ? <IconSun /> : <IconMoon />}
          </button>
        </div>
      </header>

      {/* Cinta de métricas full-width */}
      <div
        className="grid shrink-0 grid-cols-2 gap-2 border-b p-2 sm:grid-cols-4"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        aria-label="Métricas"
      >
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

      {/* Workspace: filmstrip + gemelos */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2 md:flex-row">
        {/* Filmstrip */}
        <aside
          className="flex shrink-0 gap-1.5 overflow-x-auto md:w-12 md:flex-col md:overflow-x-hidden md:overflow-y-auto"
          aria-label="Miniaturas"
        >
          {images.length === 0 && (
            <button
              type="button"
              onClick={openFilePicker}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed text-lg"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--surface)" }}
              aria-label="Agregar imagen"
              title="Agregar imagen"
            >
              +
            </button>
          )}
          {images.map((img) => (
            <div key={img.localId} className="group relative shrink-0">
              <button
                type="button"
                onClick={() => setSelectedId(img.localId)}
                className="h-10 w-10 overflow-hidden rounded-md"
                style={{
                  border: `2px solid ${selectedId === img.localId ? "var(--accent)" : STATUS_BORDER[img.status]}`,
                  background: "var(--bg)",
                }}
                title={`${img.filename} (${img.status})`}
                aria-label={`Seleccionar ${img.filename}`}
                aria-pressed={selectedId === img.localId}
              >
                {img.previewUrl ? (
                  <img src={img.previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-[9px]" style={{ color: "var(--text-secondary)" }}>
                    …
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => removeOne(img.localId)}
                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full text-[10px] leading-none group-hover:flex group-focus-within:flex"
                style={{ background: "var(--error)", color: "#fff" }}
                aria-label={`Quitar ${img.filename}`}
                title="Quitar"
              >
                ×
              </button>
            </div>
          ))}
        </aside>

        {/* Paneles gemelos */}
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-2">
          {/* Input Image */}
          <section
            className="twin-panel flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border-2"
            style={{
              borderColor: dragOver && !selected ? "var(--accent)" : "var(--border)",
              background: "var(--surface)",
            }}
            {...(!selected ? dropHandlers : {})}
          >
            <div
              className="flex h-9 shrink-0 items-center justify-center border-b px-3 text-xs font-medium"
              style={{ borderColor: "var(--border)" }}
            >
              Input Image
            </div>
            <div
              className={`flex min-h-0 flex-1 items-center justify-center overflow-auto p-3 ${!selected ? "cursor-pointer drop-target" : ""}`}
              style={!selected ? emptyDropStyle : undefined}
              onClick={!selected ? openFilePicker : undefined}
              onKeyDown={
                !selected
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openFilePicker();
                      }
                    }
                  : undefined
              }
              role={!selected ? "button" : undefined}
              tabIndex={!selected ? 0 : undefined}
              aria-label={!selected ? "Subir una imagen" : undefined}
            >
              {selected ? (
                <div
                  ref={imgWrapRef}
                  className="relative inline-block origin-center"
                  style={{ transform: `scale(${zoom})` }}
                >
                  <img
                    src={selected.previewUrl}
                    alt={selected.filename}
                    className="max-h-[min(60vh,520px)] max-w-full"
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
                            onFocus={() => setHoveredRegion(r.id)}
                            onBlur={() => setHoveredRegion(null)}
                            tabIndex={0}
                            role="button"
                            aria-label={`Región ${r.id}: ${r.text}`}
                            style={{ cursor: "pointer", outline: "none" }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                scrollToRegion(r.id);
                              }
                            }}
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
                <div className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                  <div className="mb-1 text-2xl opacity-50" aria-hidden>
                    ▢
                  </div>
                  Subí una imagen para comenzar
                  <div className="mt-1 text-[10px] opacity-70">Arrastrá, pegá (Ctrl+V) o hacé click</div>
                </div>
              )}
            </div>
            <div
              className="flex flex-wrap items-center gap-1 border-t px-2 py-1.5"
              style={{ borderColor: "var(--border)" }}
            >
              <button type="button" className="rounded px-2 py-1 text-xs" style={btnStyle} onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} aria-label="Alejar">
                −
              </button>
              <button type="button" className="rounded px-2 py-1 text-xs" style={btnStyle} onClick={() => setZoom(1)}>
                {Math.round(zoom * 100)}%
              </button>
              <button type="button" className="rounded px-2 py-1 text-xs" style={btnStyle} onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Acercar">
                +
              </button>
              <button type="button" className="rounded px-2 py-1 text-xs" style={btnStyle} onClick={() => setZoom(1)}>
                Fit
              </button>
              <div className="ml-1 flex gap-1">
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
          </section>

          {/* Result Text */}
          <section
            className="twin-panel flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border-2"
            style={{
              borderColor: dragOver && !selected ? "var(--accent)" : "var(--border)",
              background: "var(--surface)",
            }}
            {...(!selected ? dropHandlers : {})}
          >
            <div
              className="flex h-9 shrink-0 items-center justify-between border-b px-3"
              style={{ borderColor: "var(--border)" }}
            >
              <span className="flex-1 text-center text-xs font-medium">Result Text</span>
              <button
                type="button"
                disabled={!cleanText}
                onClick={copyCleanText}
                className="rounded-md px-2 py-1 text-xs disabled:opacity-40"
                style={btnStyle}
              >
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <div
              className={`flex min-h-0 flex-1 items-center justify-center overflow-auto p-3 ${!selected ? "cursor-pointer drop-target" : ""}`}
              style={!selected ? emptyDropStyle : undefined}
              onClick={!selected ? openFilePicker : undefined}
              onKeyDown={
                !selected
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openFilePicker();
                      }
                    }
                  : undefined
              }
              role={!selected ? "button" : undefined}
              tabIndex={!selected ? 0 : undefined}
              aria-label={!selected ? "Subir una imagen" : undefined}
            >
              {!selected ? (
                <div className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                  <div className="mb-1 text-2xl opacity-50" aria-hidden>
                    Aa
                  </div>
                  Subí una imagen para comenzar
                  <div className="mt-1 text-[10px] opacity-70">Arrastrá, pegá (Ctrl+V) o hacé click</div>
                </div>
              ) : !selected.result ? (
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {selected.status === "error"
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
                    const naturalWidth = textWidthPerEm(r.text);
                    const fontSize = Math.max(
                      Math.min(
                        r.textHeight * 0.85,
                        naturalWidth > 0 ? r.textWidth / naturalWidth : r.textHeight * 0.85,
                      ),
                      1,
                    );
                    const labelSize = Math.max(Math.min(r.textHeight * 0.35, 14), 8);
                    return (
                      <g
                        key={r.id}
                        onMouseEnter={() => setHoveredRegion(r.id)}
                        onMouseLeave={() => setHoveredRegion(null)}
                        onClick={() => scrollToRegion(r.id)}
                        onFocus={() => setHoveredRegion(r.id)}
                        onBlur={() => setHoveredRegion(null)}
                        tabIndex={0}
                        role="button"
                        aria-label={`Región ${r.id}: ${r.text}`}
                        style={{ cursor: "pointer", outline: "none" }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            scrollToRegion(r.id);
                          }
                        }}
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
            <div
              className="flex h-[37px] shrink-0 items-center border-t px-2 py-1.5 text-[10px]"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Texto espacial SVG
            </div>
          </section>
        </div>
      </div>

      {/* Palabras detectadas — bandeja inferior colapsable */}
      <section
        className="shrink-0 border-t"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        aria-label="Palabras detectadas"
      >
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-medium"
            style={{ color: "var(--text)" }}
            aria-expanded={wordsOpen}
            aria-controls="words-panel"
            onClick={() => setWordsOpen((o) => !o)}
          >
            <IconChevron open={wordsOpen} />
            Palabras detectadas
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-normal"
              style={{ background: "var(--surface-raised)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              {trayRegions.length}
            </span>
          </button>
        </div>
        {wordsOpen && (
          <div
            id="words-panel"
            className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto border-t px-3 py-2"
            style={{ borderColor: "var(--border)" }}
          >
            {!selected?.result && (
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {selected?.status === "error"
                  ? selected.error || "Error en inferencia"
                  : "Sin resultados aún. Ejecutá Run."}
              </p>
            )}
            {trayRegions.map((r) => {
              const color = PALETTE[r.id % PALETTE.length];
              const active = hoveredRegion === r.id;
              return (
                <div
                  key={r.id}
                  ref={(el) => {
                    regionRefs.current[r.id] = el;
                  }}
                  className="flex max-w-xs items-center gap-1.5 rounded-md px-2 py-1"
                  style={{
                    background: active ? "var(--surface-raised)" : "var(--bg)",
                    border: `1px solid ${active ? color : "var(--border)"}`,
                  }}
                  onMouseEnter={() => setHoveredRegion(r.id)}
                  onMouseLeave={() => setHoveredRegion(null)}
                  onFocus={() => setHoveredRegion(r.id)}
                  onBlur={() => setHoveredRegion(null)}
                  onClick={() => scrollToRegion(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") scrollToRegion(r.id);
                  }}
                  tabIndex={0}
                  role="listitem"
                  aria-label={`Palabra ${r.id}`}
                >
                  <span className="shrink-0 text-[10px]" style={{ color }}>
                    #{r.id}
                  </span>
                  <input
                    value={r.text}
                    onChange={(e) => updateRegionText(r.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Texto región ${r.id}`}
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
        )}
      </section>

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
        <span title={health?.cuda_compiled ? "paddle.is_compiled_with_cuda() = true" : "CPU"}>
          Device: {health?.device ?? "—"}
        </span>
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

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      style={{
        transform: open ? "rotate(0deg)" : "rotate(-90deg)",
        transition: "transform 150ms ease",
      }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div
      className="rounded-md px-2 py-1.5"
      style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
    >
      <div className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
      <div className="text-sm font-medium leading-tight">{value}</div>
    </div>
  );
}
