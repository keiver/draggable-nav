import type { ReactNode } from "react";
export type NavMode = "horizontal" | "vertical";
export type NavEdge = "left" | "right" | null;
export interface DragState {
    mode: NavMode;
    edge: NavEdge;
    isDragging: boolean;
}
export interface UseDragOptions {
    edgeThreshold?: number;
    dragThreshold?: number;
    keyboardStep?: number;
}
export interface DraggableNavProps extends UseDragOptions {
    children: (state: DragState) => ReactNode;
    className?: string | ((state: DragState) => string);
    style?: React.CSSProperties;
    ariaLabel?: string;
    viewTransitionName?: string;
    announcements?: {
        dockedLeft?: string;
        dockedRight?: string;
        horizontal?: string;
    };
    instructions?: string;
}
//# sourceMappingURL=types.d.ts.map