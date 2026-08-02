import type { StudioView } from "../types/ocr";

type StudioSubbarProps = {
  pageIndex: number;
  pageCount: number;
  studioView: StudioView;
  onStudioViewChange: (view: StudioView) => void;
  onPrev: () => void;
  onNext: () => void;
};

export function StudioSubbar({
  pageIndex,
  pageCount,
  studioView,
  onStudioViewChange,
  onPrev,
  onNext,
}: StudioSubbarProps) {
  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
        <button
          type="button"
          onClick={onPrev}
          disabled={pageIndex <= 0}
          className="rounded px-1.5 py-0.5 text-sm disabled:opacity-30"
          aria-label="Página anterior"
        >
          ‹
        </button>
        <span className="text-[11px]">
          página <span className="font-semibold" style={{ color: "var(--text)" }}>{pageIndex + 1}</span> / {pageCount}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={pageIndex >= pageCount - 1}
          className="rounded px-1.5 py-0.5 text-sm disabled:opacity-30"
          aria-label="Página siguiente"
        >
          ›
        </button>
      </div>
      <div
        className="flex overflow-hidden rounded-md"
        style={{ border: "0.5px solid var(--border)" }}
        role="group"
        aria-label="Modo de vista"
      >
        <button
          type="button"
          onClick={() => onStudioViewChange("page")}
          className="px-2.5 py-1 text-[11px]"
          style={
            studioView === "page"
              ? { background: "var(--accent)", color: "#fff" }
              : { color: "var(--text-secondary)" }
          }
          aria-pressed={studioView === "page"}
        >
          Página
        </button>
        <button
          type="button"
          onClick={() => onStudioViewChange("document")}
          className="px-2.5 py-1 text-[11px]"
          style={
            studioView === "document"
              ? { background: "var(--accent)", color: "#fff" }
              : { color: "var(--text-secondary)" }
          }
          aria-pressed={studioView === "document"}
        >
          Documento
        </button>
      </div>
    </div>
  );
}
