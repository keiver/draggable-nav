"use client";

import type { DraggableNavProps } from "./types";
import { useDrag } from "./useDrag";

export function DraggableNav({
  children,
  className,
  style,
  edgeThreshold,
  dragThreshold,
  ariaLabel = "Navigation",
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
  } = useDrag({ edgeThreshold, dragThreshold });

  return (
    <nav
      ref={navRef}
      aria-label={ariaLabel}
      className={className}
      style={{
        position: "fixed",
        display: "flex",
        flexDirection: mode === "horizontal" ? "row" : "column",
        alignItems: "center",
        borderRadius: "100px",
        touchAction: "none",
        userSelect: "none",
        cursor: isDragging ? "grabbing" : "grab",
        willChange: isDragging ? "transform" : undefined,
        // Default position: top-center for horizontal, edge for vertical
        ...(mode === "horizontal"
          ? {
              top: "1rem",
              left: "50%",
              transform: "translateX(-50%)",
              right: undefined,
            }
          : edge === "left"
            ? { top: 0, left: "0.75rem", right: undefined }
            : { top: 0, right: "0.75rem", left: undefined }),
        zIndex: 40,
        ...style,
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onClickCapture={onClickCapture}
      onDragStart={onDragStart}
    >
      {children({ mode, edge, isDragging })}
    </nav>
  );
}
