import type { CSSProperties, DragEvent, RefObject } from "react";
import { PALETTE, polyPointsAttr } from "../lib/resultLayout";
import type { ImageItem, ViewMode } from "../types/ocr";

const btnStyle: CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--border)",
  color: "var(--text)",
};

type ImageViewerProps = {
  selected: ImageItem | null;
  dragOver: boolean;
  dropHandlers: {
    onDragOver: (e: DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: DragEvent) => void;
  };
  emptyDropStyle: CSSProperties;
  onOpenFilePicker: () => void;
  imgWrapRef: RefObject<HTMLDivElement | null>;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  displaySize: { w: number; h: number };
  onImageLoad: (naturalSize: { w: number; h: number }, displaySize: { w: number; h: number }) => void;
  scaleX: number;
  scaleY: number;
  hoveredRegion: number | null;
  onHoveredRegionChange: (id: number | null) => void;
  onScrollToRegion: (id: number) => void;
  busyLabel: string;
  progressIndeterminate: boolean;
  progressPct: number;
  progress: { done: number; total: number };
  busyTimeLabel: string;
};

export function ImageViewer(props: ImageViewerProps) {
  const {
    selected, dragOver, dropHandlers, emptyDropStyle, onOpenFilePicker, imgWrapRef,
    zoom, onZoomChange, viewMode, onViewModeChange, displaySize, onImageLoad,
    scaleX, scaleY, hoveredRegion, onHoveredRegionChange, onScrollToRegion,
    busyLabel, progressIndeterminate, progressPct, progress, busyTimeLabel,
  } = props;
  return (
    <section className="twin-panel flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border-2" style={{ borderColor: dragOver && !selected ? "var(--accent)" : "var(--border)", background: "var(--surface)" }} {...(!selected ? dropHandlers : {})}>
      <div className="flex h-9 shrink-0 items-center justify-center border-b px-3 text-xs font-medium" style={{ borderColor: "var(--border)" }}>Input Image</div>
      <div
        className={`flex min-h-0 flex-1 items-center justify-center overflow-auto p-3 ${!selected ? "cursor-pointer drop-target" : ""}`}
        style={!selected ? emptyDropStyle : undefined}
        onClick={!selected ? onOpenFilePicker : undefined}
        onKeyDown={!selected ? (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenFilePicker();
          }
        } : undefined}
        role={!selected ? "button" : undefined}
        tabIndex={!selected ? 0 : undefined}
        aria-label={!selected ? "Subir una imagen" : undefined}
      >
        {selected ? (
          <div ref={imgWrapRef} className="relative inline-block origin-center" style={{ transform: `scale(${zoom})` }}>
            <img
              src={selected.previewUrl}
              alt={selected.filename}
              className="max-h-[min(60vh,520px)] max-w-full"
              onLoad={(e) => {
                const img = e.currentTarget;
                onImageLoad(
                  { w: img.naturalWidth, h: img.naturalHeight },
                  { w: img.clientWidth, h: img.clientHeight },
                );
              }}
            />
            {viewMode === "boxes" && selected.result && (
              <svg className="absolute left-0 top-0" width={displaySize.w} height={displaySize.h} style={{ pointerEvents: "auto" }}>
                {selected.result.regions.map((r, i) => {
                  const color = PALETTE[i % PALETTE.length];
                  const active = hoveredRegion === r.id;
                  const hasPoly = Array.isArray(r.poly) && r.poly.length >= 3;
                  return (
                    <g
                      key={r.id}
                      onMouseEnter={() => onHoveredRegionChange(r.id)}
                      onMouseLeave={() => onHoveredRegionChange(null)}
                      onClick={() => onScrollToRegion(r.id)}
                      onFocus={() => onHoveredRegionChange(r.id)}
                      onBlur={() => onHoveredRegionChange(null)}
                      tabIndex={0}
                      role="button"
                      aria-label={`Región ${r.id}: ${r.text}`}
                      style={{ cursor: "pointer", outline: "none" }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onScrollToRegion(r.id);
                        }
                      }}
                    >
                      {hasPoly ? (
                        <polygon points={polyPointsAttr(r.poly!, scaleX, scaleY)} stroke={color} strokeWidth={active ? 3 : 2} fill={color} fillOpacity={active ? 0.18 : 0.06} />
                      ) : (
                        <rect x={r.bbox.x * scaleX} y={r.bbox.y * scaleY} width={r.bbox.width * scaleX} height={r.bbox.height * scaleY} stroke={color} strokeWidth={active ? 3 : 2} fill={color} fillOpacity={active ? 0.18 : 0.06} rx={3} />
                      )}
                      <text x={r.bbox.x * scaleX} y={r.bbox.y * scaleY - 4} fill={color} fontSize={11} fontWeight={600}>
                        #{r.id} · {(r.confidence * 100).toFixed(0)}%
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
            {selected.status === "processing" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-sm" style={{ background: "color-mix(in srgb, var(--bg) 72%, transparent)" }} role="status" aria-live="polite" aria-busy="true">
                <div className="w-full max-w-xs text-center">
                  <div className="mb-2 font-medium" style={{ color: "var(--text)" }}>{busyLabel}</div>
                  <div className="progress-track mb-2 h-2 w-full">
                    {progressIndeterminate ? <div className="progress-bar progress-bar--indeterminate h-full" /> : <div className="progress-bar h-full" style={{ width: `${progressPct}%` }} />}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {progress.total > 1 ? `${progress.done}/${progress.total} · ${busyTimeLabel}` : `Imágenes complejas pueden tardar · ${busyTimeLabel}`}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
            <div className="mb-1 text-2xl opacity-50" aria-hidden>▢</div>
            Subí una imagen para comenzar
            <div className="mt-1 text-[10px] opacity-70">Arrastrá, pegá (Ctrl+V) o hacé click</div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1 border-t px-2 py-1.5" style={{ borderColor: "var(--border)" }}>
        <button type="button" className="rounded px-2 py-1 text-xs" style={btnStyle} onClick={() => onZoomChange(Math.max(0.25, zoom - 0.25))} aria-label="Alejar">−</button>
        <button type="button" className="rounded px-2 py-1 text-xs" style={btnStyle} onClick={() => onZoomChange(1)}>{Math.round(zoom * 100)}%</button>
        <button type="button" className="rounded px-2 py-1 text-xs" style={btnStyle} onClick={() => onZoomChange(Math.min(3, zoom + 0.25))} aria-label="Acercar">+</button>
        <button type="button" className="rounded px-2 py-1 text-xs" style={btnStyle} onClick={() => onZoomChange(1)}>Fit</button>
        <div className="ml-1 flex gap-1">
          {([
            ["original", "Original", undefined],
            ["boxes", "BB", "Bounding boxes"],
            ["text", "Texto", "Texto espacial sin cajas ni etiquetas"],
          ] as const).map(([mode, label, title]) => (
            <button key={mode} type="button" className="rounded px-2 py-1 text-xs" style={{ ...btnStyle, outline: viewMode === mode ? "1px solid var(--accent)" : undefined }} onClick={() => onViewModeChange(mode)} title={title}>{label}</button>
          ))}
        </div>
      </div>
    </section>
  );
}
