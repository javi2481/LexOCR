import type { HealthInfo, ImageItem } from "../types/ocr";

type Props = {
  images: ImageItem[];
  busy: boolean;
  lastMs: number | null;
  health: HealthInfo | null;
};

export function StatusFooter({
  images,
  busy,
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
      <span>
        {busy
          ? "En curso…"
          : images.length
            ? `${images.filter((item) => item.status === "completed").length}/${images.length} completadas`
            : "Listo"}
      </span>
      <span>Última: {lastMs != null ? `${(lastMs / 1000).toFixed(2)}s` : "—"}</span>
      <span title={health?.cuda_compiled ? "paddle.is_compiled_with_cuda() = true" : "CPU"}>
        Device: {health?.device ?? "—"}
      </span>
      <span className="ml-auto">{images.length} imágenes</span>
    </footer>
  );
}
