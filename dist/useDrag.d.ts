import type { NavMode, NavEdge } from "./types";
interface UseDragOptions {
    edgeThreshold?: number;
    dragThreshold?: number;
}
export declare function useDrag(options?: UseDragOptions): {
    navRef: import("react").RefObject<HTMLElement | null>;
    mode: NavMode;
    edge: NavEdge;
    isDragging: boolean;
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onClickCapture: (e: React.MouseEvent) => void;
    onDragStart: (e: React.DragEvent) => void;
};
export {};
//# sourceMappingURL=useDrag.d.ts.map