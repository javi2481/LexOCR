import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import { Gallery } from "./components/Gallery";
import { Header } from "./components/Header";
import { ImageViewer } from "./components/ImageViewer";
import { ResultText } from "./components/ResultText";
import { WordsTray } from "./components/WordsTray";
import {
  DEFAULT_INFER_OPTIONS,
  getHealth,
  imageUrl,
  infer,
  inferBatch,
  upload,
} from "./lib/api";
import { exportResult, type ExportFormat } from "./lib/exportResult";
import { buildResultLayout, type OrientedRegion } from "./lib/resultLayout";
import type {
  HealthInfo,
  ImageItem,
  InferOptions,
  Region,
  ViewMode,
} from "./types/ocr";

const ACCEPTED_EXT = new Set([
  "png", "jpg", "jpeg", "jfif", "bmp", "gif", "webp", "avif", "tif", "tiff",
  "ico", "ppm", "pnm",
]);
const BROWSER_PREVIEW_EXT = new Set(["png", "jpg", "jpeg", "jfif", "bmp", "gif", "webp", "avif"]);
const OCR_LS_KEY = "ocr_options";

function loadOcrOptions(): InferOptions {
  try {
    const raw = localStorage.getItem(OCR_LS_KEY);
    if (!raw) return { ...DEFAULT_INFER_OPTIONS };
    return { ...DEFAULT_INFER_OPTIONS, tier: "medium" };
  } catch {
    return { ...DEFAULT_INFER_OPTIONS, tier: "medium" };
  }
}

function fileExt(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function isAcceptedFile(file: File) {
  const ext = fileExt(file.name);
  return Boolean((ext && ACCEPTED_EXT.has(ext)) || file.type.startsWith("image/"));
}

function needsServerPreview(file: File) {
  const ext = fileExt(file.name);
  if (ext && !BROWSER_PREVIEW_EXT.has(ext)) return true;
  return file.type === "image/tiff" || file.type === "image/x-icon";
}

export default function App() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [resultZoom, setResultZoom] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("boxes");
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    localStorage.getItem("theme") === "light" ? "light" : "dark",
  );
  const [ocrOptions] = useState<InferOptions>(() => loadOcrOptions());
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Infiriendo…");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [busyElapsedSec, setBusyElapsedSec] = useState(0);
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

  const selected = images.find((item) => item.localId === selectedId) ?? null;
  const progressPct =
    progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;
  const progressIndeterminate = busy && (progress.total <= 1 || progress.done === 0);
  const busyTimeLabel =
    busyElapsedSec < 60
      ? `${busyElapsedSec}s`
      : `${Math.floor(busyElapsedSec / 60)}m ${busyElapsedSec % 60}s`;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(OCR_LS_KEY, JSON.stringify(ocrOptions));
  }, [ocrOptions]);

  useEffect(() => {
    if (!busy) {
      setBusyElapsedSec(0);
      return;
    }
    const started = Date.now();
    setBusyElapsedSec(0);
    const id = window.setInterval(() => {
      setBusyElapsedSec(Math.floor((Date.now() - started) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [busy]);

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then((info) => { if (!cancelled) setHealth(info); })
      .catch(() => { if (!cancelled) setHealth(null); });
    const id = window.setInterval(() => {
      getHealth().then((info) => {
        if (!cancelled) setHealth(info);
      }).catch(() => undefined);
    }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const element = imgWrapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const image = element.querySelector("img");
      if (image) setDisplaySize({ w: image.clientWidth, h: image.clientHeight });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [selected?.previewUrl, zoom]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files).filter(isAcceptedFile);
    if (!list.length) return;
    const next: ImageItem[] = list.map((file) => {
      const localPreview = !needsServerPreview(file);
      return {
        localId: crypto.randomUUID(),
        filename: file.name,
        status: "pending",
        previewUrl: localPreview ? URL.createObjectURL(file) : "",
        file,
        revokePreview: localPreview,
      };
    });
    setImages((previous) => [...previous, ...next]);
    setSelectedId((id) => id ?? next[0].localId);
    next.filter((item) => needsServerPreview(item.file)).forEach(async (item) => {
      try {
        const response = await upload(item.file);
        setImages((previous) =>
          previous.map((image) =>
            image.localId === item.localId
              ? {
                  ...image,
                  id: response.image_id,
                  previewUrl: imageUrl(response.image_id),
                  revokePreview: false,
                }
              : image,
          ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error al subir";
        setImages((previous) =>
          previous.map((image) =>
            image.localId === item.localId
              ? { ...image, status: "error", error: message }
              : image,
          ),
        );
      }
    });
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (!item.type.startsWith("image/")) continue;
        const blob = item.getAsFile();
        if (!blob) continue;
        const ext = blob.type.split("/")[1] || "png";
        files.push(new File([blob], `paste-${Date.now()}.${ext === "jpeg" ? "jpg" : ext}`, { type: blob.type }));
      }
      if (files.length) {
        event.preventDefault();
        addFiles(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const updateImage = (localId: string, patch: Partial<ImageItem>) => {
    setImages((previous) =>
      previous.map((image) => image.localId === localId ? { ...image, ...patch } : image),
    );
  };

  const runOne = async (item: ImageItem) => {
    updateImage(item.localId, { status: "processing", error: undefined });
    try {
      let imageId = item.id;
      if (!imageId) {
        setBusyLabel("Subiendo imagen…");
        const response = await upload(item.file);
        imageId = response.image_id;
        if (item.revokePreview && item.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(item.previewUrl);
        }
        updateImage(item.localId, {
          id: imageId,
          previewUrl: imageUrl(imageId),
          revokePreview: false,
        });
      }
      setBusyLabel("Infiriendo OCR…");
      const result = await infer(imageId, ocrOptions);
      updateImage(item.localId, { status: "completed", result, id: imageId });
      setLastMs(result.inference_time_ms);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error";
      updateImage(item.localId, { status: "error", error: message });
      throw error;
    }
  };

  const runSelected = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setBusyLabel("Preparando…");
    setProgress({ done: 0, total: 1 });
    try {
      await runOne(selected);
      setProgress({ done: 1, total: 1 });
    } finally {
      setBusy(false);
      setBusyLabel("Infiriendo…");
    }
  };

  const runAll = async () => {
    const pending = images.filter((item) => item.status === "pending" || item.status === "error");
    if (!pending.length || busy) return;
    setBusy(true);
    setBusyLabel("Preparando lotes…");
    setProgress({ done: 0, total: pending.length });
    let doneCount = 0;
    const bumpProgress = () => {
      doneCount += 1;
      setProgress({ done: doneCount, total: pending.length });
    };
    const ready: ImageItem[] = [];
    for (const item of pending) {
      const current = images.find((image) => image.localId === item.localId) ?? item;
      try {
        if (!current.id) {
          setBusyLabel(`Subiendo ${ready.length + 1}/${pending.length}…`);
          updateImage(current.localId, { status: "processing", error: undefined });
          const response = await upload(current.file);
          const previewUrl = current.revokePreview ? imageUrl(response.image_id) : current.previewUrl;
          if (current.revokePreview && current.previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(current.previewUrl);
          }
          const updated: ImageItem = {
            ...current,
            id: response.image_id,
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
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error";
        updateImage(current.localId, { status: "error", error: message });
        bumpProgress();
      }
    }
    const ids = ready.map((item) => item.id!).filter(Boolean);
    try {
      if (ids.length) {
        setBusyLabel(`Infiriendo lote (${ids.length})…`);
        const results = await inferBatch(ids, ocrOptions);
        const byId = new Map(results.map((result) => [result.image_id, result]));
        for (const item of ready) {
          const result = item.id ? byId.get(item.id) : undefined;
          if (result) {
            updateImage(item.localId, { status: "completed", result, id: item.id });
            setLastMs(result.inference_time_ms);
            bumpProgress();
          } else if (item.id) {
            try {
              setBusyLabel(`Infiriendo ${doneCount + 1}/${pending.length}…`);
              await runOne(item);
            } catch {
              // Continuar con las demás imágenes.
            }
            bumpProgress();
          } else {
            bumpProgress();
          }
        }
      }
    } catch {
      for (const item of ready) {
        try {
          setBusyLabel(`Infiriendo ${doneCount + 1}/${pending.length}…`);
          await runOne(item);
        } catch {
          // Continuar con las demás imágenes.
        }
        bumpProgress();
      }
    }
    setProgress({ done: pending.length, total: pending.length });
    setBusy(false);
    setBusyLabel("Infiriendo…");
  };

  const clearAll = () => {
    images.forEach((item) => {
      if (item.revokePreview && item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setImages([]);
    setSelectedId(null);
    setHoveredRegion(null);
    setProgress({ done: 0, total: 0 });
  };

  const removeOne = (localId: string) => {
    setImages((previous) => {
      const target = previous.find((item) => item.localId === localId);
      if (target?.revokePreview && target.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      const next = previous.filter((item) => item.localId !== localId);
      if (selectedId === localId) setSelectedId(next[0]?.localId ?? null);
      return next;
    });
  };

  const updateRegionText = (regionId: number, text: string) => {
    if (!selected?.result) return;
    const regions = selected.result.regions.map((region) =>
      region.id === regionId ? { ...region, text } : region,
    );
    updateImage(selected.localId, { result: { ...selected.result, regions } });
  };

  const orderedRegions = useMemo(() => {
    const regions = selected?.result?.regions ?? [];
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
      const avgHeight = current.reduce((sum, item) => sum + item.bbox.height, 0) / current.length;
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
    return buildResultLayout(selected.result.regions, selected.result.width, selected.result.height);
  }, [selected?.result]);

  const cleanText = useMemo(
    () => orderedRegions.map((region) => region.text.trim()).filter(Boolean).join("\n"),
    [orderedRegions],
  );

  const copyCleanText = async () => {
    if (!cleanText) return;
    await navigator.clipboard.writeText(cleanText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleExport = (format: ExportFormat) => {
    if (!selected?.result) return;
    exportResult(format, {
      result: selected.result,
      filename: selected.filename,
      orderedRegions,
      cleanText,
    });
  };

  const scaleX = displaySize.w / naturalSize.w;
  const scaleY = displaySize.h / naturalSize.h;
  const scrollToRegion = (id: number) => {
    setHoveredRegion(id);
    regionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  const openFilePicker = () => fileInputRef.current?.click();
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
  };
  const dropHandlers = {
    onDragOver: (event: DragEvent) => {
      event.preventDefault();
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
  const trayRegions = selected?.result?.regions ?? [];

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.jfif,.bmp,.gif,.webp,.avif,.tif,.tiff,.ico,.ppm,.pnm,image/*" multiple className="hidden" onChange={(event) => event.target.files && addFiles(event.target.files)} />
      <Header
        images={images}
        selected={selected}
        busy={busy}
        progressTotal={progress.total}
        theme={theme}
        onRunSelected={runSelected}
        onRunAll={runAll}
        onClear={clearAll}
        onExport={handleExport}
        onToggleTheme={() => setTheme((value) => value === "dark" ? "light" : "dark")}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2 md:flex-row">
        <Gallery images={images} selectedId={selectedId} onSelect={setSelectedId} onRemove={removeOne} onAdd={openFilePicker} />
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-2">
          <ImageViewer
            selected={selected}
            dragOver={dragOver}
            dropHandlers={dropHandlers}
            emptyDropStyle={emptyDropStyle}
            onOpenFilePicker={openFilePicker}
            imgWrapRef={imgWrapRef}
            zoom={zoom}
            onZoomChange={setZoom}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            displaySize={displaySize}
            onImageLoad={(natural, display) => {
              setNaturalSize(natural);
              setDisplaySize(display);
            }}
            scaleX={scaleX}
            scaleY={scaleY}
            hoveredRegion={hoveredRegion}
            onHoveredRegionChange={setHoveredRegion}
            onScrollToRegion={scrollToRegion}
            busyLabel={busyLabel}
            progressIndeterminate={progressIndeterminate}
            progressPct={progressPct}
            progress={progress}
            busyTimeLabel={busyTimeLabel}
          />
          <ResultText
            selected={selected}
            selectedId={selectedId}
            busy={busy}
            dragOver={dragOver}
            dropHandlers={dropHandlers}
            emptyDropStyle={emptyDropStyle}
            onOpenFilePicker={openFilePicker}
            cleanText={cleanText}
            copied={copied}
            onCopy={copyCleanText}
            busyLabel={busyLabel}
            progressIndeterminate={progressIndeterminate}
            progressPct={progressPct}
            progress={progress}
            busyTimeLabel={busyTimeLabel}
            resultLayout={resultLayout}
            resultZoom={resultZoom}
            onResultZoomChange={setResultZoom}
            viewMode={viewMode}
            hoveredRegion={hoveredRegion}
            onHoveredRegionChange={setHoveredRegion}
            onScrollToRegion={scrollToRegion}
            confThreshold={ocrOptions.conf_threshold}
          />
        </div>
      </div>
      <WordsTray
        selected={selected}
        regions={trayRegions}
        open={wordsOpen}
        onToggle={() => setWordsOpen((value) => !value)}
        busy={busy}
        busyLabel={busyLabel}
        busyTimeLabel={busyTimeLabel}
        hoveredRegion={hoveredRegion}
        onHoveredRegionChange={setHoveredRegion}
        onScrollToRegion={scrollToRegion}
        onUpdateRegionText={updateRegionText}
        regionRefs={regionRefs}
        confThreshold={ocrOptions.conf_threshold}
      />
      <footer className="flex h-9 shrink-0 items-center gap-3 border-t px-4 text-[11px]" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }}>
        {busy ? (
          <div className="flex min-w-0 flex-1 items-center gap-3" role="status" aria-live="polite">
            <span className="shrink-0 font-medium" style={{ color: "var(--text)" }}>{busyLabel}</span>
            <div className="progress-track h-1.5 min-w-[8rem] max-w-xs flex-1">
              {progressIndeterminate ? <div className="progress-bar progress-bar--indeterminate h-full" /> : <div className="progress-bar h-full" style={{ width: `${progressPct}%` }} />}
            </div>
            <span className="shrink-0 tabular-nums">{progress.total > 1 ? `${progress.done}/${progress.total}` : busyTimeLabel}</span>
          </div>
        ) : (
          <span>{images.length ? `${images.filter((item) => item.status === "completed").length}/${images.length} completadas` : "Listo"}</span>
        )}
        <span>Última: {lastMs != null ? `${(lastMs / 1000).toFixed(2)}s` : "—"}</span>
        <span title={health?.cuda_compiled ? "paddle.is_compiled_with_cuda() = true" : "CPU"}>Device: {health?.device ?? "—"}</span>
        <span className="ml-auto">{images.length} imágenes</span>
      </footer>
    </div>
  );
}
