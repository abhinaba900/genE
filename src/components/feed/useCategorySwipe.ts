"use client";

import { useEffect, useRef, useState } from "react";

const AXIS_LOCK_PX = 10;
const COMMIT_RATIO = 0.22; // of the frame width
const COMMIT_VELOCITY = 0.5; // px/ms — a quick flick commits even when short
const EDGE_RESISTANCE = 0.25;
const WHEEL_X_THRESHOLD = 60;

type Direction = -1 | 1; // -1 → previous category, 1 → next category

/**
 * Horizontal drag / swipe / trackpad gesture on the reel that switches category.
 * Vertical movement is left to the native snap scroller; the gesture locks to one axis.
 */
export function useCategorySwipe({
  frameRef,
  surfaceRef,
  contentRef,
  enabled,
  hasPrev,
  hasNext,
  reducedMotion,
  onCommit,
}: {
  frameRef: React.RefObject<HTMLElement | null>;
  /** Element that receives the gesture (defaults to the frame). On the framed /watch column
   *  this is the whole screen, so a swipe beside the 9:16 frame still works on tablets. */
  surfaceRef?: React.RefObject<HTMLElement | null>;
  contentRef: React.RefObject<HTMLElement | null>;
  enabled: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  reducedMotion: boolean;
  onCommit: (dir: Direction) => void;
}) {
  // Drag progress for the hint: -1…1 (negative = heading to next).
  const [progress, setProgress] = useState(0);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  useEffect(() => {
    const frame = frameRef.current;
    const surface = surfaceRef?.current ?? frame;
    if (!frame || !surface || !enabled) return;

    const setX = (x: number, animate: boolean, opacity = 1) => {
      const el = contentRef.current;
      if (!el) return;
      el.style.transition = animate && !reducedMotion ? "transform 280ms cubic-bezier(.2,.8,.2,1), opacity 280ms" : "none";
      el.style.transform = x ? `translate3d(${x}px,0,0)` : "";
      el.style.opacity = opacity === 1 ? "" : String(opacity);
    };

    const commit = (dir: Direction) => {
      const w = frame.clientWidth;
      setX(dir === 1 ? -w : w, true, 0);
      setProgress(0);
      commitRef.current(dir);
      // The feed remounts on the new category; if navigation stalls, put the reel back.
      window.setTimeout(() => setX(0, true), 8000);
    };

    let id: number | null = null;
    let startX = 0;
    let startY = 0;
    let startT = 0;
    let axis: "x" | "y" | null = null;
    let dx = 0;
    let suppressClick = false;

    const resist = (d: number) => ((d > 0 && !hasPrev) || (d < 0 && !hasNext) ? d * EDGE_RESISTANCE : d);

    const onDown = (e: PointerEvent) => {
      if (id !== null || (e.pointerType === "mouse" && e.button !== 0)) return;
      if (e.target instanceof Element && e.target.closest("[role='slider'], input, nav")) return;
      id = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startT = performance.now();
      axis = null;
      dx = 0;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const mx = e.clientX - startX;
      const my = e.clientY - startY;
      if (!axis) {
        if (Math.abs(mx) < AXIS_LOCK_PX && Math.abs(my) < AXIS_LOCK_PX) return;
        axis = Math.abs(mx) > Math.abs(my) * 1.2 ? "x" : "y";
        if (axis === "y") {
          id = null;
          return;
        }
        try {
          surface.setPointerCapture(e.pointerId);
        } catch {
          // Pointer already released — the drag still works without capture.
        }
      }
      e.preventDefault();
      dx = resist(mx);
      setX(dx, false);
      setProgress(Math.max(-1, Math.min(1, dx / (frame.clientWidth * COMMIT_RATIO))));
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      if (axis !== "x") return;
      suppressClick = true; // a drag is not a tap on the video
      window.setTimeout(() => (suppressClick = false), 0);
      const velocity = Math.abs(dx) / Math.max(1, performance.now() - startT);
      const far = Math.abs(dx) > frame.clientWidth * COMMIT_RATIO || velocity > COMMIT_VELOCITY;
      if (far && dx < 0 && hasNext) commit(1);
      else if (far && dx > 0 && hasPrev) commit(-1);
      else {
        setX(0, true);
        setProgress(0);
      }
    };

    const onCancel = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      if (axis === "x") {
        setX(0, true);
        setProgress(0);
      }
    };

    const onClick = (e: MouseEvent) => {
      if (!suppressClick) return;
      e.stopPropagation();
      e.preventDefault();
    };

    // Trackpad: a two-finger horizontal swipe switches category once per gesture.
    let wheelAcc = 0;
    let wheelLockedUntil = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      const now = performance.now();
      if (now < wheelLockedUntil) return;
      wheelAcc += e.deltaX;
      if (Math.abs(wheelAcc) < WHEEL_X_THRESHOLD) return;
      const dir: Direction = wheelAcc > 0 ? 1 : -1;
      wheelAcc = 0;
      wheelLockedUntil = now + 900;
      if ((dir === 1 && hasNext) || (dir === -1 && hasPrev)) commit(dir);
    };

    surface.addEventListener("pointerdown", onDown);
    surface.addEventListener("pointermove", onMove);
    surface.addEventListener("pointerup", onUp);
    surface.addEventListener("pointercancel", onCancel);
    // Native image/link dragging would swallow the mouse gesture.
    const onDragStart = (e: DragEvent) => e.preventDefault();

    surface.addEventListener("click", onClick, true);
    surface.addEventListener("wheel", onWheel, { passive: false });
    surface.addEventListener("dragstart", onDragStart);
    return () => {
      surface.removeEventListener("dragstart", onDragStart);
      surface.removeEventListener("pointerdown", onDown);
      surface.removeEventListener("pointermove", onMove);
      surface.removeEventListener("pointerup", onUp);
      surface.removeEventListener("pointercancel", onCancel);
      surface.removeEventListener("click", onClick, true);
      surface.removeEventListener("wheel", onWheel);
    };
  }, [frameRef, surfaceRef, contentRef, enabled, hasPrev, hasNext, reducedMotion]);

  return progress;
}
