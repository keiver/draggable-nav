import type { ReactNode } from "react";

export type NavMode = "horizontal" | "vertical";
export type NavEdge = "left" | "right" | null;

export interface DragState {
  mode: NavMode;
  edge: NavEdge;
  isDragging: boolean;
}

export interface DraggableNavProps {
  children: (state: DragState) => ReactNode;
  className?: string | ((state: DragState) => string);
  style?: React.CSSProperties;
  edgeThreshold?: number;
  dragThreshold?: number;
  ariaLabel?: string;
  viewTransitionName?: string;
}
