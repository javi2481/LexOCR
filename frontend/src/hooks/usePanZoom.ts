import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 0.25;

const WHEEL_STEP = 0.12;
const PAN_THRESHOLD = 3;

export function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

type UsePanZoomOptions = {
  enabled: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  /** Cambia para resetear el pan (p. ej. localId / previewUrl). */
  resetKey?: string | number | null;
};

export function usePanZoom({ enabled, zoom, onZoomChange, resetKey }: UsePanZoomOptions) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>({
    active: false,
    moved: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const resetView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    onZoomChange(1);
  }, [onZoomChange]);

  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [resetKey]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !enabled) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const prevZoom = zoomRef.current;
      const nextZoom = clampZoom(prevZoom + (event.deltaY < 0 ? WHEEL_STEP : -WHEEL_STEP));
      if (nextZoom === prevZoom) return;

      const rect = viewport.getBoundingClientRect();
      const mx = event.clientX - rect.left - rect.width / 2;
      const my = event.clientY - rect.top - rect.height / 2;
      const prevPan = panRef.current;
      const ratio = nextZoom / prevZoom;
      setPan({
        x: mx - (mx - prevPan.x) * ratio,
        y: my - (my - prevPan.y) * ratio,
      });
      onZoomChange(nextZoom);
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [enabled, onZoomChange]);

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    drag.active = false;
    drag.pointerId = null;
    setPanning(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || event.button !== 0) return;
    dragRef.current = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < PAN_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      setPanning(true);
    }
    setPan({ x: drag.originX + dx, y: drag.originY + dy });
  };

  const didPan = () => dragRef.current.moved;

  const contentStyle: CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
  };

  const viewportStyle: CSSProperties | undefined = enabled
    ? { touchAction: "none", userSelect: "none" }
    : undefined;

  const viewportClassName = enabled
    ? panning
      ? "cursor-grabbing"
      : "cursor-grab"
    : "";

  return {
    viewportRef,
    pan,
    panning,
    resetView,
    didPan,
    contentStyle,
    viewportStyle,
    viewportClassName,
    onPointerDown,
    onPointerMove,
    onPointerUp: endPan,
    onPointerCancel: endPan,
    zoomIn: () => onZoomChange(clampZoom(zoom + ZOOM_STEP)),
    zoomOut: () => onZoomChange(clampZoom(zoom - ZOOM_STEP)),
  };
}
