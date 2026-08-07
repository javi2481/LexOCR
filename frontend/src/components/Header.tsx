import type { CSSProperties } from "react";
import { downloadAnnotated } from "../lib/api";
import type { ConsolidatedDocument } from "../lib/consolidate";
import type { ExportFormat } from "../lib/exportResult";
import type { ImageItem, StudioView } from "../types/ocr";

const btnStyle: CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--border)",
  color: "var(--text)",
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

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md px-2 py-1.5" style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}>
      <div className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{label}</div>
      <div className="text-sm font-medium leading-tight">{value}</div>
    </div>
  );
}

type HeaderProps = {
  images: ImageItem[];
  selected: ImageItem | null;
  busy: boolean;
  busyLabel: string;
  busyTimeLabel: string;
  progress: { done: number; total: number };
  progressPct: number;
  progressIndeterminate: boolean;
  theme: "dark" | "light";
  studioView: StudioView;
  consolidated: ConsolidatedDocument | null;
  canExportDocument: boolean;
  onRunSelected: () => void;
  onRunAll: () => void;
  onClear: () => void;
  onExport: (format: ExportFormat) => void;
  onCopy: () => void;
  copied: boolean;
  onToggleTheme: () => void;
};

export function Header({
  images,
  selected,
  busy,
  busyLabel,
  busyTimeLabel,
  progress,
  progressPct,
  progressIndeterminate,
  theme,
  studioView,
  consolidated,
  canExportDocument,
  onRunSelected,
  onRunAll,
  onClear,
  onExport,
  onCopy,
  copied,
  onToggleTheme,
}: HeaderProps) {
  const docMode = studioView === "document";
  const exportEnabled = docMode
    ? canExportDocument
    : !!selected?.result;
  const copyEnabled = docMode
    ? canExportDocument && !!consolidated?.cleanText
    : !!selected?.result;

  return (
    <>
      <header className="flex h-12 shrink-0 flex-wrap items-center gap-2 border-b px-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white" style={{ background: "var(--accent)" }}>LX</div>
          <span className="text-sm font-semibold tracking-wide">LexOCR</span>
          <span className="rounded px-2 py-0.5 text-[10px] font-medium uppercase" style={{ background: "var(--surface-raised)", color: "var(--text-secondary)", border: "1px solid var(--border)" }} title="Motor PP-OCRv6 medium">
            PP-OCRv6 · medium
          </span>
        </div>
        {busy ? (
          <div
            className="mx-2 flex min-w-0 max-w-md flex-1 items-center gap-2"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <span className="shrink-0 text-xs font-medium" style={{ color: "var(--text)" }}>
              {busyLabel}
            </span>
            <div className="progress-track h-1.5 min-w-[6rem] flex-1">
              {progressIndeterminate ? (
                <div className="progress-bar progress-bar--indeterminate h-full" />
              ) : (
                <div className="progress-bar h-full" style={{ width: `${progressPct}%` }} />
              )}
            </div>
            <span className="shrink-0 text-[11px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {progress.total > 1 ? `${progress.done}/${progress.total}` : busyTimeLabel}
            </span>
          </div>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex gap-1" role="group" aria-label="Acciones de sesión">
            <button type="button" disabled={busy || !selected} onClick={onRunSelected} className="rounded-md px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40" style={{ background: "var(--accent)" }}>
              {busy && progress.total === 1 ? "Running…" : "Run"}
            </button>
            <button type="button" disabled={busy || !images.some((i) => i.status === "pending" || i.status === "error")} onClick={onRunAll} className="rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-40" style={btnStyle}>
              {busy && progress.total > 1 ? "Running…" : "Run All"}
            </button>
            <button type="button" onClick={onClear} className="rounded-md px-2.5 py-1 text-xs disabled:opacity-40" style={{ ...btnStyle, color: "var(--error)" }}>Clear</button>
          </div>
          <div className="flex gap-1">
            {(["json", "md", "csv", "txt"] as const).map((fmt) => (
              <button key={fmt} type="button" disabled={!exportEnabled} onClick={() => onExport(fmt)} className="rounded px-2 py-1 text-xs uppercase disabled:opacity-40" style={btnStyle}>{fmt}</button>
            ))}
            {!docMode ? (
              <button
                type="button"
                disabled={!selected?.result?.image_id || busy}
                onClick={async () => {
                  if (!selected?.result?.image_id) return;
                  try {
                    await downloadAnnotated(selected.result.image_id, `${selected.filename || "image"}_annotated.png`);
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
            ) : null}
            <button
              type="button"
              disabled={!copyEnabled}
              onClick={onCopy}
              className="rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-40"
              style={{ ...btnStyle, color: "var(--accent-text)" }}
            >
              {copied ? "Copiado" : docMode ? "Copiar documento" : "Copiar página"}
            </button>
          </div>
          <button type="button" onClick={onToggleTheme} className="rounded p-1.5" style={btnStyle} aria-label="Cambiar tema">
            {theme === "dark" ? <IconSun /> : <IconMoon />}
          </button>
        </div>
      </header>
      <div className="grid shrink-0 grid-cols-2 gap-2 border-b p-2 sm:grid-cols-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }} aria-label="Métricas">
        {docMode && consolidated ? (
          <>
            <Metric
              value={consolidated.processedCount > 0 ? `${(consolidated.metrics.confidence_avg * 100).toFixed(1)}%` : "—"}
              label="Confianza doc."
            />
            <Metric
              value={`${consolidated.processedCount}/${consolidated.totalCount}`}
              label="Páginas listas"
            />
            <Metric value={String(consolidated.metrics.regions_count)} label="Regiones" />
            <Metric value={String(consolidated.metrics.regions_to_review)} label="Baja conf." />
          </>
        ) : (
          <>
            <Metric value={selected?.result ? `${(selected.result.confidence_avg * 100).toFixed(1)}%` : "—"} label="Confianza avg" />
            <Metric value={selected?.result ? `${(selected.result.inference_time_ms / 1000).toFixed(2)}s` : "—"} label="Tiempo" />
            <Metric value={selected?.result ? String(selected.result.regions_count) : "—"} label="Regiones" />
            <Metric value={selected?.result ? String(selected.result.low_confidence_count) : "—"} label="Baja conf." />
          </>
        )}
      </div>
    </>
  );
}
