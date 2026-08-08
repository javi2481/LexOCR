import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import { DocumentView } from "./components/DocumentView";
import { Gallery } from "./components/Gallery";
import { Header } from "./components/Header";
import { ImageViewer } from "./components/ImageViewer";
import { ResultText } from "./components/ResultText";
import { StatusFooter } from "./components/StatusFooter";
import { StudioSubbar } from "./components/StudioSubbar";
import { WordsTray } from "./components/WordsTray";
import { useStudioSession } from "./hooks/useStudioSession";
import { exportDocument } from "./lib/exportDocument";
import { exportResult, type ExportFormat } from "./lib/exportResult";
import { orderRegions } from "./lib/readingOrder";
import { buildResultLayout, type OrientedRegion } from "./lib/resultLayout";
import type { ViewMode } from "./types/ocr";

export default function App() {
  const session = useStudioSession();
  const {
    images,
    selectedId,
    setSelectedId,
    selected,
    studioView,
    setStudioView,
    documentGroups,
    activeGroup,
    isMultipage,
    consolidated,
    selectPrevInGroup,
    selectNextInGroup,
    ocrOptions,
    busy,
    busyStage,
    busyLabel,
    progress,
    progressPct,
    progressIndeterminate,
    busyTimeLabel,
    lastMs,
    health,
    addFiles,
    removeOne,
    clearAll,
    runSelected,
    runAll,
    updateRegionText,
  } = session;

  const [hoveredRegion, setHoveredRegion] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [resultZoom, setResultZoom] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("boxes");
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    localStorage.getItem("theme") === "light" ? "light" : "dark",
  );
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wordsOpen, setWordsOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const regionRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 1, h: 1 });
  const [displaySize, setDisplaySize] = useState({ w: 1, h: 1 });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

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

  const orderedRegions = useMemo(
    () => orderRegions(selected?.result?.regions ?? []),
    [selected?.result?.regions],
  );

  const resultLayout = useMemo(() => {
    if (!selected?.result) {
      return { regions: [] as OrientedRegion[], canvasW: 1, canvasH: 1 };
    }
    return buildResultLayout(
      selected.result.regions,
      selected.result.width,
      selected.result.height,
    );
  }, [selected?.result]);

  const cleanText = useMemo(
    () => orderedRegions.map((region) => region.text.trim()).filter(Boolean).join("\n"),
    [orderedRegions],
  );

  const copyCleanText = async () => {
    const text =
      studioView === "document" ? consolidated?.cleanText ?? "" : cleanText;
    if (!text) return;
    if (studioView === "document" && !consolidated?.isComplete) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleExport = (format: ExportFormat) => {
    if (studioView === "document") {
      if (!consolidated?.isComplete || !activeGroup) return;
      exportDocument(format, {
        filename: activeGroup.label,
        consolidated,
      });
      return;
    }
    if (!selected?.result) return;
    exportResult(format, {
      result: selected.result,
      filename: selected.filename,
      orderedRegions,
      cleanText,
    });
  };

  const handleClear = () => {
    clearAll();
    setHoveredRegion(null);
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
  const pageIndexInGroup = activeGroup
    ? activeGroup.members.findIndex((m) => m.localId === selectedId)
    : -1;

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.jfif,.bmp,.gif,.webp,.avif,.tif,.tiff,.ico,.ppm,.pnm,.pdf,image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(event) => event.target.files && addFiles(event.target.files)}
      />
      <Header
        images={images}
        selected={selected}
        busy={busy}
        busyStage={busyStage}
        busyLabel={busyLabel}
        busyTimeLabel={busyTimeLabel}
        progress={progress}
        progressPct={progressPct}
        progressIndeterminate={progressIndeterminate}
        theme={theme}
        studioView={studioView}
        consolidated={consolidated}
        canExportDocument={!!consolidated?.isComplete}
        onRunSelected={runSelected}
        onRunAll={runAll}
        onClear={handleClear}
        onExport={handleExport}
        onCopy={copyCleanText}
        copied={copied}
        onToggleTheme={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-0 p-2 md:flex-row md:gap-2">
        <Gallery
          groups={documentGroups}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRemove={removeOne}
          onAdd={openFilePicker}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
          {isMultipage && activeGroup ? (
            <StudioSubbar
              pageIndex={Math.max(0, pageIndexInGroup)}
              pageCount={activeGroup.members.length}
              studioView={studioView}
              onStudioViewChange={setStudioView}
              onPrev={selectPrevInGroup}
              onNext={selectNextInGroup}
            />
          ) : null}
          {studioView === "document" && consolidated && activeGroup ? (
            <DocumentView
              label={activeGroup.label}
              consolidated={consolidated}
              copied={copied}
              onCopy={copyCleanText}
              onExport={handleExport}
            />
          ) : (
            <>
              <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-2 p-2 lg:grid-cols-2">
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
                  copyLabel="Copiar página"
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
              <WordsTray
                selected={selected}
                regions={trayRegions}
                open={wordsOpen}
                onToggle={() => setWordsOpen((value) => !value)}
                busy={busy}
                hoveredRegion={hoveredRegion}
                onHoveredRegionChange={setHoveredRegion}
                onScrollToRegion={scrollToRegion}
                onUpdateRegionText={updateRegionText}
                regionRefs={regionRefs}
                confThreshold={ocrOptions.conf_threshold}
              />
            </>
          )}
        </div>
      </div>
      <StatusFooter
        images={images}
        busy={busy}
        lastMs={lastMs}
        health={health}
      />
    </div>
  );
}
