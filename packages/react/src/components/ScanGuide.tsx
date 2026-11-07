"use client";

import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";

/** ROI as percentages of the camera stage (0–100). */
export type RoiRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export const DEFAULT_ROI: RoiRect = {
  left: 10,
  top: 16,
  width: 80,
  height: 62,
};

const MIN_ROI = 18;

export interface ScanGuideProps {
  className?: string;
  label?: string;
  /**
   * `corners` — bracket corners + laser (default).
   * `frame` — full rectangle mask.
   */
  variant?: "corners" | "frame";
  /** ROI box in % of the stage. Defaults to `DEFAULT_ROI`. */
  roi?: RoiRect;
  /** When true, show drag/resize handles. */
  editing?: boolean;
  onRoiChange?: (roi: RoiRect) => void;
  /** Show animated laser inside the ROI (default true). */
  showLaser?: boolean;
}

function clampRoi(roi: RoiRect): RoiRect {
  const width = Math.min(100, Math.max(MIN_ROI, roi.width));
  const height = Math.min(100, Math.max(MIN_ROI, roi.height));
  const left = Math.min(100 - width, Math.max(0, roi.left));
  const top = Math.min(100 - height, Math.max(0, roi.top));
  return { left, top, width, height };
}

type DragMode =
  | "move"
  | "resize-tl"
  | "resize-tr"
  | "resize-bl"
  | "resize-br";

/** Center viewfinder for camera guidance, with optional ROI edit. */
export function ScanGuide({
  className,
  label = "Align barcode inside the frame",
  variant = "corners",
  roi = DEFAULT_ROI,
  editing = false,
  onRoiChange,
  showLaser = true,
}: ScanGuideProps) {
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    origin: RoiRect;
    stageW: number;
    stageH: number;
  } | null>(null);

  const beginDrag = useCallback(
    (mode: DragMode, event: ReactPointerEvent<HTMLElement>) => {
      if (!editing || !onRoiChange) return;
      event.preventDefault();
      event.stopPropagation();
      const stage = event.currentTarget.closest(".qic-guide");
      if (!(stage instanceof HTMLElement)) return;
      const rect = stage.getBoundingClientRect();
      dragRef.current = {
        mode,
        startX: event.clientX,
        startY: event.clientY,
        origin: { ...roi },
        stageW: rect.width,
        stageH: rect.height,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [editing, onRoiChange, roi],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || !onRoiChange) return;

      const dx = ((event.clientX - drag.startX) / drag.stageW) * 100;
      const dy = ((event.clientY - drag.startY) / drag.stageH) * 100;
      const o = drag.origin;
      let next = { ...o };

      if (drag.mode === "move") {
        next = { ...o, left: o.left + dx, top: o.top + dy };
      } else if (drag.mode === "resize-br") {
        next = { ...o, width: o.width + dx, height: o.height + dy };
      } else if (drag.mode === "resize-bl") {
        next = {
          left: o.left + dx,
          top: o.top,
          width: o.width - dx,
          height: o.height + dy,
        };
      } else if (drag.mode === "resize-tr") {
        next = {
          left: o.left,
          top: o.top + dy,
          width: o.width + dx,
          height: o.height - dy,
        };
      } else if (drag.mode === "resize-tl") {
        next = {
          left: o.left + dx,
          top: o.top + dy,
          width: o.width - dx,
          height: o.height - dy,
        };
      }

      onRoiChange(clampRoi(next));
    },
    [onRoiChange],
  );

  const endDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }
  }, []);

  if (variant === "frame") {
    return (
      <div
        className={["qic-guide", "qic-guide--frame", className]
          .filter(Boolean)
          .join(" ")}
        role="img"
        aria-label={label}
        style={{
          left: `${roi.left}%`,
          top: `${roi.top}%`,
          width: `${roi.width}%`,
          height: `${roi.height}%`,
          right: "auto",
          bottom: "auto",
          inset: "auto",
        }}
      >
        <span className="qic-guide__label">{label}</span>
      </div>
    );
  }

  return (
    <div
      className={[
        "qic-guide",
        "qic-guide--corners",
        editing ? "qic-guide--editing" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="img"
      aria-label={label}
    >
      <div
        className="qic-guide__window"
        style={{
          left: `${roi.left}%`,
          top: `${roi.top}%`,
          width: `${roi.width}%`,
          height: `${roi.height}%`,
          right: "auto",
          bottom: "auto",
        }}
        onPointerDown={(event) => beginDrag("move", event)}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="qic-guide__corner qic-guide__corner--tl" />
        <span className="qic-guide__corner qic-guide__corner--tr" />
        <span className="qic-guide__corner qic-guide__corner--bl" />
        <span className="qic-guide__corner qic-guide__corner--br" />
        {showLaser && !editing ? <span className="qic-guide__laser" /> : null}

        {editing ? (
          <>
            {(
              [
                ["tl", "resize-tl"],
                ["tr", "resize-tr"],
                ["bl", "resize-bl"],
                ["br", "resize-br"],
              ] as const
            ).map(([pos, mode]) => (
              <button
                key={pos}
                type="button"
                className={`qic-guide__handle qic-guide__handle--${pos}`}
                aria-label={`Resize ${pos}`}
                onPointerDown={(event) => beginDrag(mode, event)}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
            ))}
          </>
        ) : null}
      </div>
      {!editing ? <span className="qic-guide__label">{label}</span> : null}
      {editing ? (
        <span className="qic-guide__edit-hint">
          Drag to move · corners to resize
        </span>
      ) : null}
    </div>
  );
}
