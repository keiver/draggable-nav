import type { NavMode, NavEdge, UseDragOptions } from "./types";
export declare function useDrag(options?: UseDragOptions): {
    navRef: import("react").RefObject<HTMLElement | null>;
    mode: NavMode;
    edge: NavEdge;
    isDragging: boolean;
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onClickCapture: (e: React.MouseEvent) => void;
    onDragStart: (e: React.DragEvent) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
};
//# sourceMappingURL=useDrag.d.ts.map