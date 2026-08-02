import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_INFER_OPTIONS,
  getHealth,
  imageUrl,
  infer,
  inferBatch,
  upload,
} from "../lib/api";
import { consolidate, consolidateSignature } from "../lib/consolidate";
import {
  findActiveGroup,
  groupImages,
  isMultipageGroup,
} from "../lib/documentGroups";
import { isAcceptedFile, isDocumentFile, needsServerPreview } from "../lib/files";
import type {
  HealthInfo,
  ImageItem,
  InferOptions,
  OCRResult,
  StudioView,
  UploadResponse,
} from "../types/ocr";

function pagesFromUpload(
  file: File,
  response: UploadResponse,
  placeholderLocalId?: string,
  groupId?: string,
): ImageItem[] {
  const pages = response.pages?.length
    ? response.pages
    : [
        {
          image_id: response.image_id,
          page_index: 0,
          page_count: 1,
          filename: response.filename,
          status: "pending",
          source_format: response.source_format,
        },
      ];
  const gid = groupId ?? crypto.randomUUID();
  return pages.map((page, index) => {
    const completed = page.status === "completed" && page.result;
    return {
      localId: index === 0 && placeholderLocalId ? placeholderLocalId : crypto.randomUUID(),
      groupId: gid,
      id: page.image_id,
      filename: page.filename || response.filename,
      status: (completed ? "completed" : page.status === "error" ? "error" : "pending") as ImageItem["status"],
      previewUrl: imageUrl(page.image_id),
      file,
      revokePreview: false,
      page_index: page.page_index,
      page_count: page.page_count,
      source_format: page.source_format ?? response.source_format,
      result: page.result as OCRResult | undefined,
    };
  });
}

export function useStudioSession() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [studioView, setStudioView] = useState<StudioView>("page");
  const [ocrOptions] = useState<InferOptions>(() => ({ ...DEFAULT_INFER_OPTIONS }));
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Infiriendo…");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [busyElapsedSec, setBusyElapsedSec] = useState(0);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);

  const selected = images.find((item) => item.localId === selectedId) ?? null;
  const documentGroups = useMemo(() => groupImages(images), [images]);
  const activeGroup = useMemo(
    () => findActiveGroup(documentGroups, selectedId),
    [documentGroups, selectedId],
  );
  const isMultipage = isMultipageGroup(activeGroup);
  const consolidateSig = activeGroup
    ? consolidateSignature(activeGroup.members)
    : "";
  const consolidated = useMemo(() => {
    if (!activeGroup || activeGroup.members.length === 0) return null;
    return consolidate(activeGroup.members);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- content signature, not array identity
  }, [consolidateSig, activeGroup?.groupId]);

  useEffect(() => {
    if (!isMultipage && studioView !== "page") {
      setStudioView("page");
    }
  }, [isMultipage, studioView]);

  const selectPrevInGroup = useCallback(() => {
    if (!activeGroup || !selectedId) return;
    const idx = activeGroup.members.findIndex((m) => m.localId === selectedId);
    if (idx <= 0) return;
    setSelectedId(activeGroup.members[idx - 1].localId);
  }, [activeGroup, selectedId]);

  const selectNextInGroup = useCallback(() => {
    if (!activeGroup || !selectedId) return;
    const idx = activeGroup.members.findIndex((m) => m.localId === selectedId);
    if (idx < 0 || idx >= activeGroup.members.length - 1) return;
    setSelectedId(activeGroup.members[idx + 1].localId);
  }, [activeGroup, selectedId]);

  const progressPct =
    progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;
  const progressIndeterminate = busy && (progress.total <= 1 || progress.done === 0);
  const busyTimeLabel =
    busyElapsedSec < 60
      ? `${busyElapsedSec}s`
      : `${Math.floor(busyElapsedSec / 60)}m ${busyElapsedSec % 60}s`;

  useEffect(() => {
    if (!busy) {
      setBusyElapsedSec(0);
      return;
    }
    const started = Date.now();
    setBusyElapsedSec(0);
    const id = window.setInterval(() => {
      setBusyElapsedSec(Math.floor((Date.now() - started) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [busy]);

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then((info) => {
        if (!cancelled) setHealth(info);
      })
      .catch(() => {
        if (!cancelled) setHealth(null);
      });
    const id = window.setInterval(() => {
      getHealth()
        .then((info) => {
          if (!cancelled) setHealth(info);
        })
        .catch(() => undefined);
    }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const updateImage = (localId: string, patch: Partial<ImageItem>) => {
    setImages((previous) =>
      previous.map((image) => (image.localId === localId ? { ...image, ...patch } : image)),
    );
  };

  const replacePlaceholderWithPages = (placeholderLocalId: string, nextPages: ImageItem[]) => {
    setImages((previous) => {
      const idx = previous.findIndex((image) => image.localId === placeholderLocalId);
      if (idx < 0) return [...previous, ...nextPages];
      const copy = [...previous];
      copy.splice(idx, 1, ...nextPages);
      return copy;
    });
    setSelectedId((id) => (id === placeholderLocalId ? nextPages[0]?.localId ?? null : id));
  };

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files).filter(isAcceptedFile);
    if (!list.length) return;
    const next: ImageItem[] = list.map((file) => {
      const localPreview = !needsServerPreview(file);
      const doc = isDocumentFile(file);
      const localId = crypto.randomUUID();
      return {
        localId,
        groupId: localId,
        filename: file.name,
        status: doc ? "processing" : "pending",
        previewUrl: localPreview ? URL.createObjectURL(file) : "",
        file,
        revokePreview: localPreview,
      };
    });
    setImages((previous) => [...previous, ...next]);
    setSelectedId((id) => id ?? next[0].localId);

    const toUpload = next.filter(
      (item) => needsServerPreview(item.file) || isDocumentFile(item.file),
    );
    const docs = toUpload.filter((item) => isDocumentFile(item.file));
    const trackDocs = docs.length > 0;
    if (trackDocs) {
      setBusy(true);
      setBusyLabel(
        docs.length === 1
          ? "Preparando documento…"
          : `Preparando ${docs.length} documentos…`,
      );
      setProgress({ done: 0, total: 1 });
    }

    void (async () => {
      try {
        for (const item of toUpload) {
          const isDoc = isDocumentFile(item.file);
          try {
            if (isDoc) {
              setBusyLabel(`Rasterizando ${item.filename}…`);
            }
            const response = await upload(item.file);
            const pages = pagesFromUpload(item.file, response, item.localId, item.groupId);
            if (item.revokePreview && item.previewUrl.startsWith("blob:")) {
              URL.revokeObjectURL(item.previewUrl);
            }
            if (pages.length > 1 || isDoc) {
              replacePlaceholderWithPages(item.localId, pages);
              if (isDoc) {
                setProgress({ done: 0, total: pages.length });
                for (let i = 0; i < pages.length; i++) {
                  const page = pages[i];
                  if (!page.id) continue;
                  setBusyLabel(`Infiriendo p.${i + 1}/${pages.length}…`);
                  updateImage(page.localId, { status: "processing", error: undefined });
                  try {
                    const result = await infer(page.id, ocrOptions);
                    updateImage(page.localId, {
                      status: "completed",
                      result,
                      id: page.id,
                    });
                    setLastMs(result.inference_time_ms);
                  } catch (error) {
                    const message = error instanceof Error ? error.message : "Error";
                    updateImage(page.localId, { status: "error", error: message });
                  }
                  setProgress({ done: i + 1, total: pages.length });
                }
              }
            } else {
              const page = pages[0];
              setImages((previous) =>
                previous.map((image) =>
                  image.localId === item.localId
                    ? {
                        ...image,
                        id: page.id,
                        groupId: page.groupId,
                        previewUrl: page.previewUrl,
                        revokePreview: false,
                        page_index: page.page_index,
                        page_count: page.page_count,
                        source_format: page.source_format,
                      }
                    : image,
                ),
              );
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : "Error al subir";
            setImages((previous) =>
              previous.map((image) =>
                image.localId === item.localId
                  ? { ...image, status: "error", error: message }
                  : image,
              ),
            );
          }
        }
      } finally {
        if (trackDocs) {
          setBusy(false);
          setBusyLabel("Infiriendo…");
        }
      }
    })();
  }, [ocrOptions]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (!item.type.startsWith("image/")) continue;
        const blob = item.getAsFile();
        if (!blob) continue;
        const ext = blob.type.split("/")[1] || "png";
        files.push(
          new File([blob], `paste-${Date.now()}.${ext === "jpeg" ? "jpg" : ext}`, {
            type: blob.type,
          }),
        );
      }
      if (files.length) {
        event.preventDefault();
        addFiles(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const runOne = async (item: ImageItem) => {
    updateImage(item.localId, { status: "processing", error: undefined });
    try {
      let imageId = item.id;
      if (!imageId) {
        setBusyLabel(
          isDocumentFile(item.file) ? "Procesando documento…" : "Subiendo imagen…",
        );
        const response = await upload(item.file);
        if (response.pages && response.pages.length > 1) {
          const pages = pagesFromUpload(item.file, response, item.localId, item.groupId);
          if (item.revokePreview && item.previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(item.previewUrl);
          }
          replacePlaceholderWithPages(item.localId, pages);
          const last = pages[pages.length - 1];
          if (last.result) setLastMs(last.result.inference_time_ms);
          return last.result!;
        }
        imageId = response.image_id;
        if (item.revokePreview && item.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(item.previewUrl);
        }
        const page0 = response.pages?.[0];
        updateImage(item.localId, {
          id: imageId,
          previewUrl: imageUrl(imageId),
          revokePreview: false,
          page_index: page0?.page_index,
          page_count: page0?.page_count,
          source_format: response.source_format,
          ...(page0?.result
            ? { status: "completed" as const, result: page0.result }
            : {}),
        });
        if (page0?.result) {
          setLastMs(page0.result.inference_time_ms);
          return page0.result;
        }
      }
      setBusyLabel("Infiriendo OCR…");
      const result = await infer(imageId, ocrOptions);
      updateImage(item.localId, { status: "completed", result, id: imageId });
      setLastMs(result.inference_time_ms);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error";
      updateImage(item.localId, { status: "error", error: message });
      throw error;
    }
  };

  const runSelected = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setBusyLabel("Preparando…");
    setProgress({ done: 0, total: 1 });
    try {
      await runOne(selected);
      setProgress({ done: 1, total: 1 });
    } finally {
      setBusy(false);
      setBusyLabel("Infiriendo…");
    }
  };

  const runAll = async () => {
    const pending = images.filter(
      (item) => item.status === "pending" || item.status === "error",
    );
    if (!pending.length || busy) return;
    setBusy(true);
    setBusyLabel("Preparando lotes…");
    setProgress({ done: 0, total: pending.length });
    let doneCount = 0;
    const bumpProgress = () => {
      doneCount += 1;
      setProgress({ done: doneCount, total: pending.length });
    };
    const ready: ImageItem[] = [];
    for (const item of pending) {
      const current = images.find((image) => image.localId === item.localId) ?? item;
      try {
        if (!current.id) {
          setBusyLabel(`Subiendo ${ready.length + 1}/${pending.length}…`);
          updateImage(current.localId, { status: "processing", error: undefined });
          const response = await upload(current.file);
          if (response.pages && response.pages.length > 1) {
            const pages = pagesFromUpload(current.file, response, current.localId, current.groupId);
            if (current.revokePreview && current.previewUrl.startsWith("blob:")) {
              URL.revokeObjectURL(current.previewUrl);
            }
            replacePlaceholderWithPages(current.localId, pages);
            for (const page of pages) {
              if (page.result) setLastMs(page.result.inference_time_ms);
              bumpProgress();
            }
            continue;
          }
          const previewUrl = current.revokePreview
            ? imageUrl(response.image_id)
            : current.previewUrl;
          if (current.revokePreview && current.previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(current.previewUrl);
          }
          const page0 = response.pages?.[0];
          if (page0?.result) {
            updateImage(current.localId, {
              id: response.image_id,
              previewUrl,
              revokePreview: false,
              status: "completed",
              result: page0.result,
              page_index: page0.page_index,
              page_count: page0.page_count,
              source_format: response.source_format,
            });
            setLastMs(page0.result.inference_time_ms);
            bumpProgress();
            continue;
          }
          const updated: ImageItem = {
            ...current,
            id: response.image_id,
            previewUrl,
            revokePreview: false,
            status: "processing",
          };
          updateImage(current.localId, updated);
          ready.push(updated);
        } else {
          updateImage(current.localId, { status: "processing", error: undefined });
          ready.push({ ...current, status: "processing" });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error";
        updateImage(current.localId, { status: "error", error: message });
        bumpProgress();
      }
    }
    const ids = ready.map((item) => item.id!).filter(Boolean);
    try {
      if (ids.length) {
        setBusyLabel(`Infiriendo lote (${ids.length})…`);
        const results = await inferBatch(ids, ocrOptions);
        const byId = new Map(results.map((result) => [result.image_id, result]));
        for (const item of ready) {
          const result = item.id ? byId.get(item.id) : undefined;
          if (result) {
            updateImage(item.localId, { status: "completed", result, id: item.id });
            setLastMs(result.inference_time_ms);
            bumpProgress();
          } else if (item.id) {
            try {
              setBusyLabel(`Infiriendo ${doneCount + 1}/${pending.length}…`);
              await runOne(item);
            } catch {
              // Continuar con las demás imágenes.
            }
            bumpProgress();
          } else {
            bumpProgress();
          }
        }
      }
    } catch {
      for (const item of ready) {
        try {
          setBusyLabel(`Infiriendo ${doneCount + 1}/${pending.length}…`);
          await runOne(item);
        } catch {
          // Continuar con las demás imágenes.
        }
        bumpProgress();
      }
    }
    setProgress({ done: pending.length, total: pending.length });
    setBusy(false);
    setBusyLabel("Infiriendo…");
  };

  const clearAll = () => {
    images.forEach((item) => {
      if (item.revokePreview && item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setImages([]);
    setSelectedId(null);
    setProgress({ done: 0, total: 0 });
  };

  const removeOne = (localId: string) => {
    setImages((previous) => {
      const target = previous.find((item) => item.localId === localId);
      if (target?.revokePreview && target.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      const next = previous.filter((item) => item.localId !== localId);
      if (selectedId === localId) setSelectedId(next[0]?.localId ?? null);
      return next;
    });
  };

  const updateRegionText = (regionId: number, text: string) => {
    if (!selected?.result) return;
    const regions = selected.result.regions.map((region) =>
      region.id === regionId ? { ...region, text } : region,
    );
    updateImage(selected.localId, { result: { ...selected.result, regions } });
  };

  return {
    images,
    selectedId,
    setSelectedId,
    selected,
    studioView,
    setStudioView,
    documentGroups,
    activeGroup,
    isMultipage,
    consolidated,
    selectPrevInGroup,
    selectNextInGroup,
    ocrOptions,
    busy,
    busyLabel,
    progress,
    progressPct,
    progressIndeterminate,
    busyTimeLabel,
    lastMs,
    health,
    addFiles,
    removeOne,
    clearAll,
    runSelected,
    runAll,
    updateRegionText,
  };
}
