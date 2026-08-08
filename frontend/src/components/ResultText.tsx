import type { CSSProperties, DragEvent } from "react";
import { usePanZoom } from "../hooks/usePanZoom";
import {
  PALETTE,
  confColor,
  polyPointsAttr,
  textWidthPerEm,
  type OrientedRegion,
} from "../lib/resultLayout";
import type { ImageItem, ViewMode } from "../types/ocr";

const btnStyle: CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--border)",
  color: "var(--text)",
};

type ResultTextProps = {
  selected: ImageItem | null;
  selectedId: string | null;
  busy: boolean;
  dragOver: boolean;
  dropHandlers: {
    onDragOver: (e: DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: DragEvent) => void;
  };
  emptyDropStyle: CSSProperties;
  onOpenFilePicker: () => void;
  cleanText: string;
  copied: boolean;
  onCopy: () => void;
  copyLabel?: string;
  resultLayout: { regions: OrientedRegion[]; canvasW: number; canvasH: number };
  resultZoom: number;
  onResultZoomChange: (zoom: number) => void;
  viewMode: ViewMode;
  hoveredRegion: number | null;
  onHoveredRegionChange: (id: number | null) => void;
  onScrollToRegion: (id: number) => void;
  confThreshold: number;
};

export function ResultText(props: ResultTextProps) {
  const {
    selected, selectedId, busy, dragOver, dropHandlers, emptyDropStyle,
    onOpenFilePicker, cleanText, copied, onCopy, copyLabel = "Copiar",
    resultLayout, resultZoom,
    onResultZoomChange, viewMode, hoveredRegion, onHoveredRegionChange,
    onScrollToRegion, confThreshold,
  } = props;

  const hasResult = !!selected?.result;
  const {
    viewportRef,
    panning,
    resetView,
    didPan,
    contentStyle,
    viewportStyle,
    viewportClassName,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    zoomIn,
    zoomOut,
  } = usePanZoom({
    enabled: hasResult,
    zoom: resultZoom,
    onZoomChange: onResultZoomChange,
    resetKey: selected?.result
      ? `${selected.localId}:${selected.result.inference_time_ms}:${selected.result.regions_count}`
      : null,
  });

  const onRegionActivate = (id: number) => {
    if (didPan()) return;
    onScrollToRegion(id);
  };

  return (
    <section className="twin-panel flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border-2" style={{ borderColor: dragOver && !selected ? "var(--accent)" : "var(--border)", background: "var(--surface)" }} {...(!selected ? dropHandlers : {})}>
      <div className="flex h-9 shrink-0 items-center justify-between border-b px-3" style={{ borderColor: "var(--border)" }}>
        <span className="flex-1 text-center text-xs font-medium">Texto para LLM</span>
        <button type="button" disabled={!cleanText} onClick={onCopy} className="rounded-md px-2 py-1 text-xs disabled:opacity-40" style={btnStyle}>
          {copied ? "Copiado" : copyLabel}
        </button>
      </div>
      <div
        ref={viewportRef}
        className={`flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 ${!selected ? "cursor-pointer drop-target" : hasResult ? viewportClassName : ""}`}
        style={!selected ? emptyDropStyle : hasResult ? viewportStyle : undefined}
        onClick={!selected ? onOpenFilePicker : undefined}
        onKeyDown={!selected ? (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenFilePicker();
          }
        } : undefined}
        onPointerDown={hasResult ? onPointerDown : undefined}
        onPointerMove={hasResult ? onPointerMove : undefined}
        onPointerUp={hasResult ? onPointerUp : undefined}
        onPointerCancel={hasResult ? onPointerCancel : undefined}
        role={!selected ? "button" : undefined}
        tabIndex={!selected ? 0 : undefined}
        aria-label={
          !selected
            ? "Subir una imagen"
            : hasResult
              ? "Resultado OCR: rueda para zoom, arrastrar para desplazar"
              : undefined
        }
      >
        {!selected ? (
          <div className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
            <div className="mb-1 text-2xl opacity-50" aria-hidden>Aa</div>
            Subí una imagen para comenzar
            <div className="mt-1 text-[10px] opacity-70">Arrastrá, pegá (Ctrl+V) o hacé click</div>
          </div>
        ) : !selected.result ? (
          <div className="flex w-full max-w-xs flex-col items-center gap-2 px-4 text-center">
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {selected.status === "error"
                ? selected.error || "Error en inferencia"
                : selected.status === "processing" || (busy && selectedId === selected.localId)
                  ? "Procesando… el progreso está arriba en el header."
                  : "Sin resultados aún. Ejecutá Run."}
            </p>
          </div>
        ) : (
          <div className="origin-center will-change-transform" style={contentStyle}>
            <svg
              viewBox={`0 0 ${resultLayout.canvasW} ${resultLayout.canvasH}`}
              className="max-h-full w-full border bg-white shadow-sm"
              style={{
                borderColor: "var(--border)",
                pointerEvents: panning ? "none" : "auto",
              }}
              role="img"
              aria-label="ResultText"
            >
              {resultLayout.regions.map((r, i) => {
                const showBoxes = viewMode !== "text";
                const color = PALETTE[i % PALETTE.length];
                const active = hoveredRegion === r.id;
                const naturalWidth = textWidthPerEm(r.text);
                const fontSize = Math.max(Math.min(r.textHeight * 0.85, naturalWidth > 0 ? r.textWidth / naturalWidth : r.textHeight * 0.85), 1);
                const labelSize = Math.max(Math.min(r.textHeight * 0.35, 14), 8);
                return (
                  <g
                    key={r.id}
                    onMouseEnter={() => onHoveredRegionChange(r.id)}
                    onMouseLeave={() => onHoveredRegionChange(null)}
                    onClick={() => onRegionActivate(r.id)}
                    onFocus={() => onHoveredRegionChange(r.id)}
                    onBlur={() => onHoveredRegionChange(null)}
                    tabIndex={0}
                    role="button"
                    aria-label={`Región ${r.id}: ${r.text}`}
                    style={{ cursor: panning ? "grabbing" : "pointer", outline: "none" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRegionActivate(r.id);
                      }
                    }}
                  >
                    {showBoxes && <polygon points={polyPointsAttr(r.poly, 1, 1)} fill={active ? `${color}18` : "none"} stroke={color} strokeWidth={active ? 2.5 : 1.5} />}
                    <text x={0} y={0} fill="#111827" fontSize={fontSize} fontFamily="system-ui, sans-serif" textAnchor="middle" dominantBaseline="central" transform={`translate(${r.cx} ${r.cy}) rotate(${r.angleDeg})`}>{r.text}</text>
                    {showBoxes && (
                      <text x={r.labelX} y={Math.max(r.labelY - 2, labelSize)} fill={confColor(r.confidence, confThreshold)} fontSize={labelSize} fontWeight={600} textAnchor="end" fontFamily="system-ui, sans-serif">
                        {(r.confidence * 100).toFixed(0)}%
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>
      <div className="flex h-[37px] shrink-0 items-center gap-1 border-t px-2 py-1.5" style={{ borderColor: "var(--border)" }}>
        <button type="button" className="rounded px-2 py-1 text-xs" style={btnStyle} onClick={zoomOut} aria-label="Alejar resultado">−</button>
        <button type="button" className="rounded px-2 py-1 text-xs" style={btnStyle} onClick={resetView}>{Math.round(resultZoom * 100)}%</button>
        <button type="button" className="rounded px-2 py-1 text-xs" style={btnStyle} onClick={zoomIn} aria-label="Acercar resultado">+</button>
        <button type="button" className="rounded px-2 py-1 text-xs" style={btnStyle} onClick={resetView}>Fit</button>
        <span className="ml-1 text-[10px]" style={{ color: "var(--text-secondary)" }}>
          {viewMode === "text" ? "Texto espacial (sin cajas)" : "Texto espacial SVG"}
        </span>
      </div>
    </section>
  );
}
