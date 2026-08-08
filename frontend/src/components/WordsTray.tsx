import type { RefObject } from "react";
import { PALETTE, confColor } from "../lib/resultLayout";
import type { ImageItem, Region } from "../types/ocr";

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 150ms ease" }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

type WordsTrayProps = {
  selected: ImageItem | null;
  regions: Region[];
  open: boolean;
  onToggle: () => void;
  busy: boolean;
  hoveredRegion: number | null;
  onHoveredRegionChange: (id: number | null) => void;
  onScrollToRegion: (id: number) => void;
  onUpdateRegionText: (id: number, text: string) => void;
  regionRefs: RefObject<Record<number, HTMLDivElement | null>>;
  confThreshold: number;
};

export function WordsTray(props: WordsTrayProps) {
  const {
    selected, regions, open, onToggle, busy,
    hoveredRegion, onHoveredRegionChange, onScrollToRegion, onUpdateRegionText,
    regionRefs, confThreshold,
  } = props;
  return (
    <section className="shrink-0 border-t" style={{ borderColor: "var(--border)", background: "var(--surface)" }} aria-label="Palabras detectadas">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button type="button" className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--text)" }} aria-expanded={open} aria-controls="words-panel" onClick={onToggle}>
          <IconChevron open={open} />
          Palabras detectadas
          <span className="rounded px-1.5 py-0.5 text-[10px] font-normal" style={{ background: "var(--surface-raised)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>{regions.length}</span>
        </button>
      </div>
      {open && (
        <div id="words-panel" className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto border-t px-3 py-2" style={{ borderColor: "var(--border)" }}>
          {!selected?.result && (
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {selected?.status === "error"
                ? selected.error || "Error en inferencia"
                : selected?.status === "processing" || busy
                  ? "Procesando… mirá las etapas en el header."
                  : "Sin resultados aún. Ejecutá Run."}
            </p>
          )}
          {regions.map((r) => {
            const color = PALETTE[r.id % PALETTE.length];
            const active = hoveredRegion === r.id;
            return (
              <div
                key={r.id}
                ref={(el) => { regionRefs.current[r.id] = el; }}
                className="flex max-w-xs items-center gap-1.5 rounded-md px-2 py-1"
                style={{ background: active ? "var(--surface-raised)" : "var(--bg)", border: `1px solid ${active ? color : "var(--border)"}` }}
                onMouseEnter={() => onHoveredRegionChange(r.id)}
                onMouseLeave={() => onHoveredRegionChange(null)}
                onFocus={() => onHoveredRegionChange(r.id)}
                onBlur={() => onHoveredRegionChange(null)}
                onClick={() => onScrollToRegion(r.id)}
                onKeyDown={(e) => { if (e.key === "Enter") onScrollToRegion(r.id); }}
                tabIndex={0}
                role="listitem"
                aria-label={`Palabra ${r.id}`}
              >
                <span className="shrink-0 text-[10px]" style={{ color }}>#{r.id}</span>
                <input value={r.text} onChange={(e) => onUpdateRegionText(r.id, e.target.value)} onClick={(e) => e.stopPropagation()} aria-label={`Texto región ${r.id}`} className="min-w-0 flex-1 bg-transparent text-xs outline-none" style={{ color: "var(--text)" }} />
                <span className="shrink-0 text-[10px]" style={{ color: confColor(r.confidence, confThreshold) }}>{(r.confidence * 100).toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
