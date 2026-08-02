import { useEffect, useState } from "react";
import type { DocumentGroup } from "../lib/documentGroups";
import type { ImageItem, Status } from "../types/ocr";

const STATUS_DOT: Record<Status, string> = {
  pending: "var(--border-strong, var(--border))",
  processing: "var(--accent)",
  completed: "var(--success)",
  error: "var(--error)",
};

function statusDotColor(item: ImageItem): string {
  if (item.status === "completed" && (item.result?.low_confidence_count ?? 0) > 0) {
    return "var(--warning)";
  }
  return STATUS_DOT[item.status];
}

type GalleryProps = {
  groups: DocumentGroup[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
};

function PageRow({
  item,
  selected,
  onSelect,
  onRemove,
  indent,
}: {
  item: ImageItem;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  indent?: boolean;
}) {
  const pageNum = (item.page_index ?? 0) + 1;
  return (
    <div
      className="group relative flex items-center gap-1.5 rounded-md px-1.5 py-1"
      style={{
        marginLeft: indent ? 6 : 0,
        background: selected ? "var(--accent-tint)" : undefined,
        border: selected ? "0.5px solid var(--accent)" : "0.5px solid transparent",
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        aria-pressed={selected}
        aria-label={`Seleccionar página ${pageNum} de ${item.filename}`}
      >
        <div
          className="h-[26px] w-5 shrink-0 overflow-hidden rounded-sm"
          style={{ background: "var(--surface-raised)", border: "0.5px solid var(--border)" }}
        >
          {item.previewUrl ? (
            <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <span
          className="min-w-0 flex-1 truncate text-[11px]"
          style={{ color: selected ? "var(--accent-text)" : "var(--text-secondary)", fontWeight: selected ? 600 : 400 }}
        >
          p.{pageNum}
        </span>
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: statusDotColor(item) }}
          title={item.status}
        />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="absolute -right-0.5 -top-0.5 hidden h-4 w-4 items-center justify-center rounded-full text-[10px] leading-none group-hover:flex group-focus-within:flex"
        style={{ background: "var(--error)", color: "#fff" }}
        aria-label={`Quitar página ${pageNum}`}
        title="Quitar"
      >
        ×
      </button>
    </div>
  );
}

function SingleRow({
  item,
  selected,
  onSelect,
  onRemove,
}: {
  item: ImageItem;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="group relative flex items-center gap-1.5 rounded-md px-1.5 py-1"
      style={{
        background: selected ? "var(--accent-tint)" : undefined,
        border: selected ? "0.5px solid var(--accent)" : "0.5px solid transparent",
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        aria-pressed={selected}
        aria-label={`Seleccionar ${item.filename}`}
      >
        <div
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[10px]"
          style={{ background: "var(--surface-raised)", color: "var(--text-secondary)" }}
        >
          ▣
        </div>
        <span
          className="min-w-0 flex-1 truncate text-[11px]"
          style={{ color: selected ? "var(--accent-text)" : "var(--text)", fontWeight: selected ? 600 : 400 }}
        >
          {item.filename}
        </span>
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: statusDotColor(item) }}
          title={item.status}
        />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="absolute -right-0.5 -top-0.5 hidden h-4 w-4 items-center justify-center rounded-full text-[10px] leading-none group-hover:flex group-focus-within:flex"
        style={{ background: "var(--error)", color: "#fff" }}
        aria-label={`Quitar ${item.filename}`}
        title="Quitar"
      >
        ×
      </button>
    </div>
  );
}

function MultipageGroup({
  group,
  selectedId,
  onSelect,
  onRemove,
}: {
  group: DocumentGroup;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const containsSelected = group.members.some((m) => m.localId === selectedId);
  const [open, setOpen] = useState(containsSelected);

  useEffect(() => {
    if (containsSelected) setOpen(true);
  }, [containsSelected]);

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left"
        style={{ color: "var(--text-secondary)" }}
        aria-expanded={open}
      >
        <span className="w-3.5 text-[10px]" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
        <span className="text-[11px]" style={{ color: "var(--error)" }} aria-hidden>
          PDF
        </span>
        <span className="min-w-0 flex-1 truncate text-[11px]" style={{ color: "var(--text)" }}>
          {group.label}
        </span>
        <span className="shrink-0 text-[10px]" style={{ color: "var(--text-muted, var(--text-secondary))" }}>
          {group.members.length} p
        </span>
      </button>
      {open
        ? group.members.map((item) => (
            <PageRow
              key={item.localId}
              item={item}
              selected={selectedId === item.localId}
              onSelect={() => onSelect(item.localId)}
              onRemove={() => onRemove(item.localId)}
              indent
            />
          ))
        : null}
    </div>
  );
}

export function Gallery({ groups, selectedId, onSelect, onRemove, onAdd }: GalleryProps) {
  return (
    <aside
      className="flex w-full shrink-0 flex-col gap-1 overflow-y-auto md:w-[170px]"
      aria-label="Documentos"
      style={{ background: "var(--bg)", borderRight: "0.5px solid var(--border)" }}
    >
      <div className="flex flex-1 flex-col gap-1 p-2">
        <span className="px-1 pb-1 text-[11px]" style={{ color: "var(--text-muted, var(--text-secondary))" }}>
          Documentos
        </span>
        {groups.map((group) =>
          group.members.length > 1 ? (
            <MultipageGroup
              key={group.groupId}
              group={group}
              selectedId={selectedId}
              onSelect={onSelect}
              onRemove={onRemove}
            />
          ) : (
            <SingleRow
              key={group.groupId}
              item={group.members[0]}
              selected={selectedId === group.members[0].localId}
              onSelect={() => onSelect(group.members[0].localId)}
              onRemove={() => onRemove(group.members[0].localId)}
            />
          ),
        )}
        <button
          type="button"
          onClick={onAdd}
          className="mt-auto flex items-center justify-center gap-1 rounded-md border border-dashed py-1.5 text-[11px]"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          aria-label="Agregar documento"
          title="Agregar"
        >
          + Agregar
        </button>
      </div>
    </aside>
  );
}
