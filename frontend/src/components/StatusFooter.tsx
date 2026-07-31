import type { HealthInfo, ImageItem } from "../types/ocr";

type Props = {
  images: ImageItem[];
  busy: boolean;
  busyLabel: string;
  busyTimeLabel: string;
  progress: { done: number; total: number };
  progressPct: number;
  progressIndeterminate: boolean;
  lastMs: number | null;
  health: HealthInfo | null;
};

export function StatusFooter({
  images,
  busy,
  busyLabel,
  busyTimeLabel,
  progress,
  progressPct,
  progressIndeterminate,
  lastMs,
  health,
}: Props) {
  return (
    <footer
      className="flex h-9 shrink-0 items-center gap-3 border-t px-4 text-[11px]"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface)",
        color: "var(--text-secondary)",
      }}
    >
      {busy ? (
        <div className="flex min-w-0 flex-1 items-center gap-3" role="status" aria-live="polite">
          <span className="shrink-0 font-medium" style={{ color: "var(--text)" }}>
            {busyLabel}
          </span>
          <div className="progress-track h-1.5 min-w-[8rem] max-w-xs flex-1">
            {progressIndeterminate ? (
              <div className="progress-bar progress-bar--indeterminate h-full" />
            ) : (
              <div className="progress-bar h-full" style={{ width: `${progressPct}%` }} />
            )}
          </div>
          <span className="shrink-0 tabular-nums">
            {progress.total > 1 ? `${progress.done}/${progress.total}` : busyTimeLabel}
          </span>
        </div>
      ) : (
        <span>
          {images.length
            ? `${images.filter((item) => item.status === "completed").length}/${images.length} completadas`
            : "Listo"}
        </span>
      )}
      <span>Última: {lastMs != null ? `${(lastMs / 1000).toFixed(2)}s` : "—"}</span>
      <span title={health?.cuda_compiled ? "paddle.is_compiled_with_cuda() = true" : "CPU"}>
        Device: {health?.device ?? "—"}
      </span>
      <span className="ml-auto">{images.length} imágenes</span>
    </footer>
  );
}
