"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import type { NavMode, NavEdge, UseDragOptions } from "./types";

// ---------------------------------------------------------------------------
// Parameter clamping
// ---------------------------------------------------------------------------

function safeClamp(value: number | undefined, fallback: number, min: number): number {
  return value != null && Number.isFinite(value) ? Math.max(min, value) : fallback;
}

// ---------------------------------------------------------------------------
// Snap helpers (shared between handlePointerMove and handlePointerUp)
// ---------------------------------------------------------------------------

function withViewTransition(cb: () => void) {
  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  if (document.startViewTransition && !prefersReduced) {
    document.startViewTransition(cb);
  } else {
    cb();
  }
}

function snapToVerticalEdge(
  nav: HTMLElement,
  newMode: NavMode,
  newEdge: NavEdge,
  setMode: (m: NavMode) => void,
  setEdge: (e: NavEdge) => void,
  setIsDragging: (d: boolean) => void,
  offsetRef: { current: { x: number; y: number } },
) {
  withViewTransition(() => {
    nav.style.transform = "";
    flushSync(() => {
      setMode(newMode);
      setEdge(newEdge);
      setIsDragging(false);
    });
    const rectAfter = nav.getBoundingClientRect();
    const centeredY = (window.innerHeight - rectAfter.height) / 2;
    offsetRef.current = { x: 0, y: centeredY - rectAfter.top };
    nav.style.transform = `translate3d(0, ${offsetRef.current.y}px, 0)`;
  });
}

function snapToHorizontalCenter(
  nav: HTMLElement,
  setMode: (m: NavMode) => void,
  setEdge: (e: NavEdge) => void,
  setIsDragging: (d: boolean) => void,
  offsetRef: { current: { x: number; y: number } },
) {
  withViewTransition(() => {
    nav.style.transform = "";
    flushSync(() => {
      setMode("horizontal");
      setEdge(null);
      setIsDragging(false);
    });
    const rectAfter = nav.getBoundingClientRect();
    const centeredX = (window.innerWidth - rectAfter.width) / 2;
    offsetRef.current = { x: centeredX - rectAfter.left, y: 0 };
    nav.style.transform = `translate3d(${offsetRef.current.x}px, 0, 0)`;
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDrag(options: UseDragOptions = {}) {
  const edgeThreshold = safeClamp(options.edgeThreshold, 60, 0);
  const dragThreshold = safeClamp(options.dragThreshold, 5, 0);
  const keyboardStep = safeClamp(options.keyboardStep, 20, 1);

  const navRef = useRef<HTMLElement>(null);

  const [mode, setMode] = useState<NavMode>("horizontal");
  const [edge, setEdge] = useState<NavEdge>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPointerDown, setIsPointerDown] = useState(false);

  // Refs for drag tracking (no re-renders during drag)
  const isDraggingRef = useRef(false);
  const startPointerRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const modeRef = useRef(mode);
  const edgeRef = useRef(edge);
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragDeltaRef = useRef({ x: 0, y: 0 });

  // Threshold refs — avoid stale closures in stable callbacks
  const edgeThresholdRef = useRef(edgeThreshold);
  const dragThresholdRef = useRef(dragThreshold);
  const keyboardStepRef = useRef(keyboardStep);

  // Keep refs in sync with state/props
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    edgeRef.current = edge;
  }, [edge]);
  useEffect(() => {
    edgeThresholdRef.current = edgeThreshold;
  }, [edgeThreshold]);
  useEffect(() => {
    dragThresholdRef.current = dragThreshold;
  }, [dragThreshold]);
  useEffect(() => {
    keyboardStepRef.current = keyboardStep;
  }, [keyboardStep]);

  // Force GPU compositing layer at mount to prevent first-drag flicker
  useEffect(() => {
    if (navRef.current) {
      navRef.current.style.transform = "translate3d(0, 0, 0)";
    }
  }, []);

  // Re-clamp position when viewport resizes (e.g. window resize, device rotation)
  useEffect(() => {
    let rafId: number;
    const onResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const nav = navRef.current;
        if (!nav) return;

        const rect = nav.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let clampX = 0;
        let clampY = 0;

        if (rect.left < 0) clampX = -rect.left;
        else if (rect.right > vw) clampX = vw - rect.right;

        if (rect.top < 0) clampY = -rect.top;
        else if (rect.bottom > vh) clampY = vh - rect.bottom;

        if (clampX !== 0 || clampY !== 0) {
          offsetRef.current = {
            x: offsetRef.current.x + clampX,
            y: offsetRef.current.y + clampY,
          };
          nav.style.transform = `translate3d(${offsetRef.current.x}px, ${offsetRef.current.y}px, 0)`;
        }
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // --- Drag handlers ---

  const handlePointerDown = useCallback(
    (clientX: number, clientY: number) => {
      startPointerRef.current = { x: clientX, y: clientY };
      dragDeltaRef.current = { x: 0, y: 0 };
      hasDraggedRef.current = false;
      setIsPointerDown(true);
    },
    []
  );

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      const dx = clientX - startPointerRef.current.x;
      const dy = clientY - startPointerRef.current.y;

      // Check threshold before committing to drag
      if (!isDraggingRef.current) {
        if (Math.abs(dx) < dragThresholdRef.current && Math.abs(dy) < dragThresholdRef.current)
          return;
        isDraggingRef.current = true;
        hasDraggedRef.current = true;
        setIsDragging(true);
      }

      const nav = navRef.current;
      if (!nav) return;

      const rawTotalX = offsetRef.current.x + dx;
      const rawTotalY = offsetRef.current.y + dy;
      nav.style.transform = `translate3d(${rawTotalX}px, ${rawTotalY}px, 0)`;

      // Clamp to viewport bounds
      const rect = nav.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let clampX = 0;
      let clampY = 0;

      if (rect.left < 0) clampX = -rect.left;
      else if (rect.right > vw) clampX = vw - rect.right;

      if (rect.top < 0) clampY = -rect.top;
      else if (rect.bottom > vh) clampY = vh - rect.bottom;

      const totalX = rawTotalX + clampX;
      const totalY = rawTotalY + clampY;

      if (clampX !== 0 || clampY !== 0) {
        nav.style.transform = `translate3d(${totalX}px, ${totalY}px, 0)`;
      }

      dragDeltaRef.current = {
        x: totalX - offsetRef.current.x,
        y: totalY - offsetRef.current.y,
      };

      // Edge detection during drag (use clamped rect)
      const clampedLeft = rect.left + clampX;
      const clampedRight = rect.right + clampX;
      const clampedTop = rect.top + clampY;
      const clampedBottom = rect.bottom + clampY;

      let newMode: NavMode | null = null;
      let newEdge: NavEdge = null;

      if (clampedLeft < edgeThresholdRef.current) {
        newMode = "vertical";
        newEdge = "left";
      } else if (clampedRight > vw - edgeThresholdRef.current) {
        newMode = "vertical";
        newEdge = "right";
      } else if (
        modeRef.current === "vertical" &&
        (clampedTop < edgeThresholdRef.current || clampedBottom > vh - edgeThresholdRef.current)
      ) {
        newMode = "horizontal";
        newEdge = null;
      }

      // Snap to left/right edge → vertical, center on Y axis
      if (newMode === "vertical" && (newMode !== modeRef.current || newEdge !== edgeRef.current)) {
        isDraggingRef.current = false;
        setIsPointerDown(false);
        dragDeltaRef.current = { x: 0, y: 0 };
        snapToVerticalEdge(nav, newMode, newEdge, setMode, setEdge, setIsDragging, offsetRef);
      }

      // Push to top/bottom edge → horizontal, center on X axis
      if (newMode === "horizontal" && modeRef.current === "vertical") {
        isDraggingRef.current = false;
        setIsPointerDown(false);
        dragDeltaRef.current = { x: 0, y: 0 };
        snapToHorizontalCenter(nav, setMode, setEdge, setIsDragging, offsetRef);
      }
    },
    []
  );

  const handlePointerUp = useCallback(() => {
    setIsPointerDown(false);

    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const nav = navRef.current;
    if (!nav) return;

    // Commit this drag's delta into the persistent offset
    offsetRef.current = {
      x: offsetRef.current.x + dragDeltaRef.current.x,
      y: offsetRef.current.y + dragDeltaRef.current.y,
    };

    // Edge detection on release
    const rect = nav.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let newMode: NavMode | null = null;
    let newEdge: NavEdge = null;

    if (rect.left < edgeThresholdRef.current) {
      newMode = "vertical";
      newEdge = "left";
    } else if (rect.right > vw - edgeThresholdRef.current) {
      newMode = "vertical";
      newEdge = "right";
    } else if (
      modeRef.current === "vertical" &&
      (rect.top < edgeThresholdRef.current || rect.bottom > vh - edgeThresholdRef.current)
    ) {
      newMode = "horizontal";
      newEdge = null;
    }

    const edgeSwitch =
      newMode === "vertical" &&
      (newMode !== modeRef.current || newEdge !== edgeRef.current);

    const topBottomSwitch =
      newMode === "horizontal" && modeRef.current === "vertical";

    if (edgeSwitch) {
      snapToVerticalEdge(nav, newMode!, newEdge, setMode, setEdge, setIsDragging, offsetRef);
    } else if (topBottomSwitch) {
      snapToHorizontalCenter(nav, setMode, setEdge, setIsDragging, offsetRef);
    } else {
      // No mode change — just stop dragging, bar stays in place
      setIsDragging(false);
    }
  }, []);

  // --- Keyboard handler ---

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Only handle keyboard movement when the nav container itself is focused,
    // not when a child (e.g. a link) inside it is focused.
    if (e.target !== e.currentTarget) return;

    const nav = navRef.current;
    if (!nav) return;

    const step = keyboardStepRef.current;

    if (e.key === "Escape") {
      // Reset to horizontal center
      snapToHorizontalCenter(nav, setMode, setEdge, setIsDragging, offsetRef);
      return;
    }

    let dx = 0;
    let dy = 0;

    switch (e.key) {
      case "ArrowLeft":
        dx = -step;
        break;
      case "ArrowRight":
        dx = step;
        break;
      case "ArrowUp":
        dy = -step;
        break;
      case "ArrowDown":
        dy = step;
        break;
      default:
        return;
    }

    // Prevent page scroll on arrow keys
    e.preventDefault();

    // Apply movement
    const newX = offsetRef.current.x + dx;
    const newY = offsetRef.current.y + dy;
    nav.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;

    // Clamp to viewport bounds
    const rect = nav.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let clampX = 0;
    let clampY = 0;

    if (rect.left < 0) clampX = -rect.left;
    else if (rect.right > vw) clampX = vw - rect.right;

    if (rect.top < 0) clampY = -rect.top;
    else if (rect.bottom > vh) clampY = vh - rect.bottom;

    const clampedX = newX + clampX;
    const clampedY = newY + clampY;

    if (clampX !== 0 || clampY !== 0) {
      nav.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
    }

    offsetRef.current = { x: clampedX, y: clampedY };

    // Edge detection after keyboard movement
    const clampedLeft = rect.left + clampX;
    const clampedRight = rect.right + clampX;

    if (clampedLeft < edgeThresholdRef.current) {
      snapToVerticalEdge(nav, "vertical", "left", setMode, setEdge, setIsDragging, offsetRef);
    } else if (clampedRight > vw - edgeThresholdRef.current) {
      snapToVerticalEdge(nav, "vertical", "right", setMode, setEdge, setIsDragging, offsetRef);
    } else {
      const clampedTop = rect.top + clampY;
      const clampedBottom = rect.bottom + clampY;
      if (
        modeRef.current === "vertical" &&
        (clampedTop < edgeThresholdRef.current || clampedBottom > vh - edgeThresholdRef.current)
      ) {
        snapToHorizontalCenter(nav, setMode, setEdge, setIsDragging, offsetRef);
      }
    }
  }, []);

  // Prevent clicks from firing after a drag
  const handleClickCapture = useCallback((e: React.MouseEvent) => {
    if (hasDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      hasDraggedRef.current = false;
    }
  }, []);

  // Prevent browser native link/image drag
  const handleNativeDragStart = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Mouse events on nav
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      handlePointerDown(e.clientX, e.clientY);
    },
    [handlePointerDown]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      handlePointerDown(touch.clientX, touch.clientY);
    },
    [handlePointerDown]
  );

  // Global listeners (attached from pointer-down to pointer-up)
  useEffect(() => {
    if (!isPointerDown) return;

    const onMouseMove = (e: MouseEvent) =>
      handlePointerMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onMouseUp = () => handlePointerUp();
    const onTouchEnd = () => handlePointerUp();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [isPointerDown, handlePointerMove, handlePointerUp]);

  return {
    navRef,
    mode,
    edge,
    isDragging,
    onMouseDown,
    onTouchStart,
    onClickCapture: handleClickCapture,
    onDragStart: handleNativeDragStart,
    onKeyDown: handleKeyDown,
  };
}
