"use client";

import { useId, useEffect, useRef, useState } from "react";
import type { DraggableNavProps } from "./types";
import { useDrag } from "./useDrag";

const srOnly: React.CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  borderWidth: 0,
};

export function DraggableNav({
  children,
  className,
  style,
  edgeThreshold,
  dragThreshold,
  keyboardStep,
  ariaLabel = "Navigation",
  viewTransitionName: vtName,
  announcements,
  instructions,
}: DraggableNavProps) {
  const {
    navRef,
    mode,
    edge,
    isDragging,
    onMouseDown,
    onTouchStart,
    onClickCapture,
    onDragStart,
    onKeyDown,
  } = useDrag({ edgeThreshold, dragThreshold, keyboardStep });

  const descriptionId = useId();
  const [announcement, setAnnouncement] = useState("");
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    const defaults = {
      dockedLeft: "Navigation docked to left edge",
      dockedRight: "Navigation docked to right edge",
      horizontal: "Navigation at top center",
    };
    const merged = { ...defaults, ...announcements };
    if (mode === "vertical" && edge === "left") setAnnouncement(merged.dockedLeft!);
    else if (mode === "vertical" && edge === "right") setAnnouncement(merged.dockedRight!);
    else if (mode === "horizontal") setAnnouncement(merged.horizontal!);
  }, [mode, edge, announcements]);

  const resolvedClassName =
    typeof className === "function"
      ? className({ mode, edge, isDragging })
      : className;

  const instructionText =
    instructions ?? "Use arrow keys to reposition. Press Escape to reset.";

  return (
    <nav
      ref={navRef}
      tabIndex={0}
      aria-label={ariaLabel}
      aria-roledescription="draggable"
      aria-describedby={descriptionId}
      className={resolvedClassName}
      style={{
        position: "fixed",
        display: "flex",
        flexDirection: mode === "horizontal" ? "row" : "column",
        alignItems: "center",
        borderRadius: "100px",
        touchAction: "none",
        userSelect: "none",
        cursor: isDragging ? "grabbing" : "grab",
        willChange: "transform",
        viewTransitionName: vtName ?? "main-nav",
        zIndex: 1000,
        ...(mode === "horizontal"
          ? { top: "1rem", left: "50%", translate: "-50% 0", right: "auto" }
          : edge === "left"
            ? { top: "50%", left: "8px", right: "auto", translate: "0 -50%" }
            : { top: "50%", right: "8px", left: "auto", translate: "0 -50%" }),
        ...style,
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onClickCapture={onClickCapture}
      onDragStart={onDragStart}
      onKeyDown={onKeyDown}
    >
      {children({ mode, edge, isDragging })}
      <span id={descriptionId} style={srOnly}>
        {instructionText}
      </span>
      <div role="status" aria-live="polite" style={srOnly}>
        {announcement}
      </div>
    </nav>
  );
}
