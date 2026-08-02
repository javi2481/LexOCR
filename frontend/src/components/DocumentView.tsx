import type { CSSProperties } from "react";
import type { ConsolidatedDocument } from "../lib/consolidate";
import type { ExportFormat } from "../lib/exportResult";

const btnStyle: CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--border)",
  color: "var(--text)",
};

type DocumentViewProps = {
  label: string;
  consolidated: ConsolidatedDocument;
  copied: boolean;
  onCopy: () => void;
  onExport: (format: ExportFormat) => void;
};

export function DocumentView({
  label,
  consolidated,
  copied,
  onCopy,
  onExport,
}: DocumentViewProps) {
  const { metrics, processedCount, totalCount, isComplete, cleanText } = consolidated;
  const canExport = isComplete && !!cleanText;

  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      aria-label="Vista documento"
    >
      <div
        className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
      >
        <span className="text-xs font-semibold">{label}</span>
        <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {totalCount} páginas · {metrics.regions_count} regiones
        </span>
        {!isComplete ? (
          <span
            className="rounded-md px-2 py-0.5 text-[11px]"
            style={{ background: "var(--warning-tint)", color: "var(--warning)" }}
            role="status"
          >
            {processedCount} / {totalCount} páginas procesadas
          </span>
        ) : null}
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2 p-3" style={{ background: "var(--bg)" }}>
        <div className="rounded-md p-3" style={{ background: "var(--surface)" }}>
          <div className="mb-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
            Confianza media del documento
          </div>
          <div className="text-xl font-semibold">
            {processedCount > 0 ? `${(metrics.confidence_avg * 100).toFixed(1)}%` : "—"}
          </div>
        </div>
        <div className="rounded-md p-3" style={{ background: "var(--surface)" }}>
          <div className="mb-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
            Regiones a revisar
          </div>
          <div className="text-xl font-semibold" style={{ color: metrics.regions_to_review ? "var(--warning)" : undefined }}>
            {processedCount > 0 ? metrics.regions_to_review : "—"}{" "}
            {metrics.pages_with_low > 0 ? (
              <span className="text-xs font-normal" style={{ color: "var(--text-secondary)" }}>
                en {metrics.pages_with_low} págs
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3" style={{ background: "var(--bg)" }}>
        <pre
          className="whitespace-pre-wrap rounded-md border p-3 font-mono text-[11px] leading-relaxed"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
            color: "var(--text-secondary)",
            minHeight: "8rem",
          }}
        >
          {cleanText || (processedCount === 0 ? "Sin páginas procesadas aún…" : "_(sin texto)_")}
        </pre>
      </div>

      <div
        className="flex shrink-0 flex-wrap items-center gap-2 border-t px-3 py-2"
        style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
      >
        <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          Exportar documento completo
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {(["md", "json", "txt", "csv"] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              disabled={!canExport}
              onClick={() => onExport(fmt)}
              className="rounded-md px-2 py-1 text-[11px] uppercase disabled:opacity-40"
              style={btnStyle}
            >
              {fmt}
            </button>
          ))}
          <button
            type="button"
            disabled={!canExport}
            onClick={onCopy}
            className="rounded-md px-3 py-1 text-[11px] font-medium text-white disabled:opacity-40"
            style={{ background: "var(--accent)" }}
            title={!isComplete ? `Documento incompleto (${processedCount}/${totalCount})` : undefined}
          >
            {copied ? "Copiado" : "Copiar documento"}
          </button>
        </div>
      </div>
    </section>
  );
}
