"use client";

import { useEffect, useState, type RefObject } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Tracks an element's content-box size via ResizeObserver.
 * Only updates React state when dimensions actually change.
 */
export function useElementSize(
  ref: RefObject<HTMLElement | null>,
): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      setSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    };

    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
