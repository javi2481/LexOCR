import type { ImageItem, Status } from "../types/ocr";

const STATUS_BORDER: Record<Status, string> = {
  pending: "var(--border)",
  processing: "var(--accent)",
  completed: "var(--success)",
  error: "var(--error)",
};

type GalleryProps = {
  images: ImageItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
};

export function Gallery({ images, selectedId, onSelect, onRemove, onAdd }: GalleryProps) {
  return (
    <aside className="flex shrink-0 gap-1.5 overflow-x-auto md:w-12 md:flex-col md:overflow-x-hidden md:overflow-y-auto" aria-label="Miniaturas">
      {images.map((img) => (
        <div key={img.localId} className="group relative shrink-0">
          <button
            type="button"
            onClick={() => onSelect(img.localId)}
            className="h-10 w-10 overflow-hidden rounded-md"
            style={{
              border: `2px solid ${selectedId === img.localId ? "var(--accent)" : STATUS_BORDER[img.status]}`,
              background: "var(--bg)",
            }}
            title={`${img.filename} (${img.status})`}
            aria-label={`Seleccionar ${img.filename}`}
            aria-pressed={selectedId === img.localId}
          >
            {img.previewUrl ? (
              <img src={img.previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center text-[9px]" style={{ color: "var(--text-secondary)" }}>…</span>
            )}
          </button>
          <button type="button" onClick={() => onRemove(img.localId)} className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full text-[10px] leading-none group-hover:flex group-focus-within:flex" style={{ background: "var(--error)", color: "#fff" }} aria-label={`Quitar ${img.filename}`} title="Quitar">
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={onAdd} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed text-lg" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--surface)" }} aria-label="Agregar imagen" title="Agregar imagen">
        +
      </button>
    </aside>
  );
}
