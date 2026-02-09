"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useDrag } from "./useDrag";
export function DraggableNav({ children, className, style, edgeThreshold, dragThreshold, ariaLabel = "Navigation", viewTransitionName: vtName, }) {
    const { navRef, mode, edge, isDragging, onMouseDown, onTouchStart, onClickCapture, onDragStart, } = useDrag({ edgeThreshold, dragThreshold });
    const resolvedClassName = typeof className === "function"
        ? className({ mode, edge, isDragging })
        : className;
    return (_jsx("nav", { ref: navRef, "aria-label": ariaLabel, className: resolvedClassName, style: {
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
        }, onMouseDown: onMouseDown, onTouchStart: onTouchStart, onClickCapture: onClickCapture, onDragStart: onDragStart, children: children({ mode, edge, isDragging }) }));
}
//# sourceMappingURL=DraggableNav.js.map