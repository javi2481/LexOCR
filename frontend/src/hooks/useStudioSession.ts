import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_INFER_OPTIONS,
  getHealth,
  imageUrl,
  infer,
  inferBatch,
  upload,
} from "../lib/api";
import { isAcceptedFile, needsServerPreview } from "../lib/files";
import type { HealthInfo, ImageItem, InferOptions } from "../types/ocr";

const OCR_LS_KEY = "ocr_options";

function loadOcrOptions(): InferOptions {
  try {
    const raw = localStorage.getItem(OCR_LS_KEY);
    if (!raw) return { ...DEFAULT_INFER_OPTIONS };
    return { ...DEFAULT_INFER_OPTIONS, tier: "medium" };
  } catch {
    return { ...DEFAULT_INFER_OPTIONS, tier: "medium" };
  }
}

export function useStudioSession() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ocrOptions] = useState<InferOptions>(() => loadOcrOptions());
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Infiriendo…");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [busyElapsedSec, setBusyElapsedSec] = useState(0);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);

  const selected = images.find((item) => item.localId === selectedId) ?? null;
  const progressPct =
    progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;
  const progressIndeterminate = busy && (progress.total <= 1 || progress.done === 0);
  const busyTimeLabel =
    busyElapsedSec < 60
      ? `${busyElapsedSec}s`
      : `${Math.floor(busyElapsedSec / 60)}m ${busyElapsedSec % 60}s`;

  useEffect(() => {
    localStorage.setItem(OCR_LS_KEY, JSON.stringify(ocrOptions));
  }, [ocrOptions]);

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

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files).filter(isAcceptedFile);
    if (!list.length) return;
    const next: ImageItem[] = list.map((file) => {
      const localPreview = !needsServerPreview(file);
      return {
        localId: crypto.randomUUID(),
        filename: file.name,
        status: "pending",
        previewUrl: localPreview ? URL.createObjectURL(file) : "",
        file,
        revokePreview: localPreview,
      };
    });
    setImages((previous) => [...previous, ...next]);
    setSelectedId((id) => id ?? next[0].localId);
    next
      .filter((item) => needsServerPreview(item.file))
      .forEach(async (item) => {
        try {
          const response = await upload(item.file);
          setImages((previous) =>
            previous.map((image) =>
              image.localId === item.localId
                ? {
                    ...image,
                    id: response.image_id,
                    previewUrl: imageUrl(response.image_id),
                    revokePreview: false,
                  }
                : image,
            ),
          );
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
      });
  }, []);

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
        setBusyLabel("Subiendo imagen…");
        const response = await upload(item.file);
        imageId = response.image_id;
        if (item.revokePreview && item.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(item.previewUrl);
        }
        updateImage(item.localId, {
          id: imageId,
          previewUrl: imageUrl(imageId),
          revokePreview: false,
        });
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
          const previewUrl = current.revokePreview
            ? imageUrl(response.image_id)
            : current.previewUrl;
          if (current.revokePreview && current.previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(current.previewUrl);
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
