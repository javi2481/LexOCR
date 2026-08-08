import { useState, type CSSProperties } from "react";
import { downloadAnnotated } from "../lib/api";
import type { ConsolidatedDocument } from "../lib/consolidate";
import type { ExportFormat } from "../lib/exportResult";
import { PIPELINE_STAGES, type BusyStage } from "../lib/pipeline";
import type { ImageItem, StudioView } from "../types/ocr";

const btnStyle: CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--border)",
  color: "var(--text)",
};

function IconSpinner() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

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

type MetricTone = "neutral" | "accent" | "success" | "warning" | "danger";

const TONE_VAR: Record<MetricTone, string> = {
  neutral: "var(--text-secondary)",
  accent: "var(--accent-text)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--error)",
};

function confidenceTone(avg: number): MetricTone {
  if (avg >= 0.9) return "success";
  if (avg >= 0.75) return "accent";
  return "warning";
}

function Metric({
  value,
  label,
  ready = false,
  tone = "neutral",
}: {
  value: string;
  label: string;
  ready?: boolean;
  tone?: MetricTone;
}) {
  const accent = TONE_VAR[ready ? tone : "neutral"];
  return (
    <div
      className={`metric-card rounded-md px-3 py-2 ${ready ? "metric-card--ready" : ""}`}
      style={{
        background: ready
          ? `color-mix(in srgb, ${accent} 14%, var(--surface-raised))`
          : "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderLeft: ready ? `3px solid ${accent}` : "1px solid var(--border)",
        boxShadow: ready ? `inset 0 0 0 1px color-mix(in srgb, ${accent} 18%, transparent)` : undefined,
      }}
    >
      <div
        className="text-[10px] font-medium uppercase tracking-wide"
        style={{ color: ready ? accent : "var(--text-secondary)" }}
      >
        {label}
      </div>
      <div
        className={`tabular-nums leading-tight ${ready ? "text-xl font-semibold" : "text-sm font-medium"}`}
        style={{ color: ready ? "var(--text)" : "var(--text-muted)" }}
      >
        {value}
      </div>
    </div>
  );
}

function stageIndex(stage: BusyStage | null) {
  if (!stage) return -1;
  return PIPELINE_STAGES.findIndex((s) => s.id === stage);
}

type HeaderProps = {
  images: ImageItem[];
  selected: ImageItem | null;
  busy: boolean;
  busyStage: BusyStage | null;
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
  busyStage,
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
  const [exportingPng, setExportingPng] = useState(false);
  const docMode = studioView === "document";
  const exportEnabled = docMode
    ? canExportDocument
    : !!selected?.result;
  const copyEnabled = docMode
    ? canExportDocument && !!consolidated?.cleanText
    : !!selected?.result;
  const pageReady = !!selected?.result && selected.status === "completed";
  const docReady = !!consolidated && consolidated.processedCount > 0;
  const metricsReady = docMode ? docReady : pageReady;
  const activeStageIdx = stageIndex(busyStage);
  const stageHint = PIPELINE_STAGES.find((s) => s.id === busyStage)?.hint;

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
                disabled={!selected?.result?.image_id || busy || exportingPng}
                onClick={async () => {
                  if (!selected?.result?.image_id || exportingPng) return;
                  setExportingPng(true);
                  try {
                    await downloadAnnotated(selected.result.image_id, `${selected.filename || "image"}_annotated.png`);
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setExportingPng(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs uppercase disabled:opacity-40"
                style={btnStyle}
                title={exportingPng ? "Generando PNG anotado…" : "PNG anotado con el resultado OCR actual"}
                aria-busy={exportingPng}
              >
                {exportingPng ? <IconSpinner /> : null}
                {exportingPng ? "png…" : "png"}
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
      {busy ? (
        <div
          className="pipeline-progress shrink-0 border-b px-3 py-2"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-1" aria-label="Etapas del parseo">
              {PIPELINE_STAGES.map((stage, index) => {
                const done = activeStageIdx > index;
                const active = activeStageIdx === index;
                return (
                  <li key={stage.id} className="flex items-center gap-1">
                    {index > 0 ? (
                      <span
                        className="mx-0.5 h-px w-4 sm:w-6"
                        style={{ background: done || active ? "var(--accent)" : "var(--border)" }}
                        aria-hidden
                      />
                    ) : null}
                    <span
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
                      style={{
                        color: done || active ? "var(--text)" : "var(--text-muted)",
                        background: active
                          ? "var(--accent-tint)"
                          : done
                            ? "color-mix(in srgb, var(--success) 14%, transparent)"
                            : "transparent",
                        border: `1px solid ${
                          active ? "var(--accent)" : done ? "color-mix(in srgb, var(--success) 45%, var(--border))" : "var(--border)"
                        }`,
                      }}
                      title={stage.hint}
                      aria-current={active ? "step" : undefined}
                    >
                      <span
                        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm text-[9px] font-bold"
                        style={{
                          background: done ? "var(--success)" : active ? "var(--accent)" : "var(--surface-raised)",
                          color: done || active ? "#fff" : "var(--text-muted)",
                        }}
                        aria-hidden
                      >
                        {done ? "✓" : index + 1}
                      </span>
                      {stage.label}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="flex shrink-0 items-center gap-2 text-[11px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {progress.total > 1 ? (
                <span>
                  {progress.done}/{progress.total}
                </span>
              ) : null}
              <span>{busyTimeLabel}</span>
              <span className="font-medium" style={{ color: "var(--text)" }}>
                {progressPct}%
              </span>
            </div>
          </div>
          <div className="mb-1 flex min-w-0 items-baseline gap-2">
            <p className="truncate text-xs font-medium" style={{ color: "var(--text)" }}>
              {busyLabel}
            </p>
            {stageHint ? (
              <p className="hidden truncate text-[10px] sm:block" style={{ color: "var(--text-muted)" }}>
                {stageHint}
              </p>
            ) : null}
          </div>
          <div
            className="progress-track h-2 w-full"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressIndeterminate ? undefined : progressPct}
            aria-valuetext={busyLabel}
          >
            {progressIndeterminate ? (
              <div className="progress-bar progress-bar--indeterminate h-full" />
            ) : (
              <div className="progress-bar h-full" style={{ width: `${progressPct}%` }} />
            )}
          </div>
        </div>
      ) : null}
      <div
        key={
          docMode && consolidated
            ? `doc-${consolidated.processedCount}-${consolidated.metrics.regions_count}-${consolidated.metrics.confidence_avg}`
            : selected?.result
              ? `${selected.localId}-${selected.result.inference_time_ms}-${selected.result.regions_count}`
              : "metrics-idle"
        }
        className={`metrics-strip grid shrink-0 grid-cols-2 gap-2 border-b p-2 sm:grid-cols-4 ${metricsReady ? "metrics-strip--ready" : ""}`}
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        aria-label="Métricas"
      >
        {docMode && consolidated ? (
          <>
            <Metric
              ready={docReady}
              tone={confidenceTone(consolidated.metrics.confidence_avg)}
              value={docReady ? `${(consolidated.metrics.confidence_avg * 100).toFixed(1)}%` : "—"}
              label="Confianza doc."
            />
            <Metric
              ready={docReady}
              tone={consolidated.isComplete ? "success" : "accent"}
              value={`${consolidated.processedCount}/${consolidated.totalCount}`}
              label="Páginas listas"
            />
            <Metric
              ready={docReady}
              tone="accent"
              value={String(consolidated.metrics.regions_count)}
              label="Regiones"
            />
            <Metric
              ready={docReady}
              tone={consolidated.metrics.regions_to_review > 0 ? "warning" : "success"}
              value={String(consolidated.metrics.regions_to_review)}
              label="Baja conf."
            />
          </>
        ) : (
          <>
            <Metric
              ready={pageReady}
              tone={selected?.result ? confidenceTone(selected.result.confidence_avg) : "neutral"}
              value={selected?.result ? `${(selected.result.confidence_avg * 100).toFixed(1)}%` : "—"}
              label="Confianza avg"
            />
            <Metric
              ready={pageReady}
              tone="accent"
              value={selected?.result ? `${(selected.result.inference_time_ms / 1000).toFixed(2)}s` : "—"}
              label="Tiempo"
            />
            <Metric
              ready={pageReady}
              tone="accent"
              value={selected?.result ? String(selected.result.regions_count) : "—"}
              label="Regiones"
            />
            <Metric
              ready={pageReady}
              tone={(selected?.result?.low_confidence_count ?? 0) > 0 ? "warning" : "success"}
              value={selected?.result ? String(selected.result.low_confidence_count) : "—"}
              label="Baja conf."
            />
          </>
        )}
      </div>
    </>
  );
}
