import React, { useRef, useState } from "react";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

type Point = { x: number; y: number };

function distance(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

export default function ZoomableScreenshot({ src, alt }: { src: string; alt: string }) {
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<
    | { type: "pinch"; startDistance: number; startZoom: number }
    | { type: "pan"; startPoint: Point; startPan: Point }
    | null
  >(null);

  const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

  const updateZoom = (value: number) => {
    const nextZoom = clampZoom(value);
    setZoom(nextZoom);
    if (nextZoom === MIN_ZOOM) setPan({ x: 0, y: 0 });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const currentPointers = Array.from(pointers.current.values());

    if (currentPointers.length >= 2) {
      gesture.current = {
        type: "pinch",
        startDistance: distance(currentPointers[0]!, currentPointers[1]!),
        startZoom: zoom,
      };
    } else if (zoom > MIN_ZOOM) {
      gesture.current = {
        type: "pan",
        startPoint: currentPointers[0]!,
        startPan: pan,
      };
      setIsDragging(true);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const currentPointers = Array.from(pointers.current.values());

    if (gesture.current?.type === "pinch" && currentPointers.length >= 2) {
      const currentDistance = distance(currentPointers[0]!, currentPointers[1]!);
      if (gesture.current.startDistance > 0) {
        updateZoom(gesture.current.startZoom * currentDistance / gesture.current.startDistance);
      }
    } else if (gesture.current?.type === "pan" && currentPointers.length === 1) {
      setPan({
        x: gesture.current.startPan.x + currentPointers[0]!.x - gesture.current.startPoint.x,
        y: gesture.current.startPan.y + currentPointers[0]!.y - gesture.current.startPoint.y,
      });
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    const remainingPointers = Array.from(pointers.current.values());
    if (remainingPointers.length >= 2) {
      gesture.current = {
        type: "pinch",
        startDistance: distance(remainingPointers[0]!, remainingPointers[1]!),
        startZoom: zoom,
      };
      return;
    }

    if (remainingPointers.length === 1 && zoom > MIN_ZOOM) {
      gesture.current = {
        type: "pan",
        startPoint: remainingPointers[0]!,
        startPan: pan,
      };
      return;
    }

    gesture.current = null;
    setIsDragging(false);
  };

  const handleZoomButton = (amount: number) => {
    updateZoom(zoom + amount);
  };

  const handleDoubleClick = () => {
    updateZoom(zoom > MIN_ZOOM ? zoom - 0.5 : zoom + 0.5);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-end gap-2">
        <span className="min-w-12 text-center font-mono text-xs text-muted-foreground" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Zoom out"
          onClick={() => handleZoomButton(-ZOOM_STEP)}
          disabled={zoom === MIN_ZOOM}
        >
          <ZoomOut />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Reset zoom"
          onClick={() => {
            updateZoom(MIN_ZOOM);
            setPan({ x: 0, y: 0 });
          }}
          disabled={zoom === MIN_ZOOM}
        >
          <RotateCcw />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Zoom in"
          onClick={() => handleZoomButton(ZOOM_STEP)}
          disabled={zoom === MAX_ZOOM}
        >
          <ZoomIn />
        </Button>
      </div>
      <div
        className={`relative min-h-0 w-full flex-1 touch-none select-none overflow-hidden rounded-xl border border-border/60 bg-muted/40 ${
          zoom > MIN_ZOOM ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
        }`}
        aria-label="Screenshot viewing area; pinch to zoom and drag to pan"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
        onDoubleClick={handleDoubleClick}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="absolute left-1/2 top-1/2 max-h-full max-w-full object-contain"
          style={{
            transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        />
      </div>
    </div>
  );
}
