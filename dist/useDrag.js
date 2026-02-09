"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
export function useDrag(options = {}) {
    const { edgeThreshold = 60, dragThreshold = 5 } = options;
    const navRef = useRef(null);
    const [mode, setMode] = useState("horizontal");
    const [edge, setEdge] = useState(null);
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
    // Keep refs in sync with state
    useEffect(() => {
        modeRef.current = mode;
    }, [mode]);
    useEffect(() => {
        edgeRef.current = edge;
    }, [edge]);
    // --- View Transition helper ---
    const withViewTransition = useCallback((cb) => {
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if ("startViewTransition" in document && !prefersReducedMotion) {
            document.startViewTransition(cb);
        }
        else {
            cb();
        }
    }, []);
    // --- Snap helpers ---
    const snapToVertical = useCallback((nav, newEdge) => {
        withViewTransition(() => {
            nav.style.transform = "";
            flushSync(() => {
                setMode("vertical");
                setEdge(newEdge);
                setIsDragging(false);
            });
            const rectAfter = nav.getBoundingClientRect();
            const centeredY = (window.innerHeight - rectAfter.height) / 2;
            offsetRef.current = { x: 0, y: centeredY - rectAfter.top };
            nav.style.transform = `translate3d(0, ${offsetRef.current.y}px, 0)`;
        });
    }, [withViewTransition]);
    const snapToHorizontal = useCallback((nav) => {
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
    }, [withViewTransition]);
    // --- Drag handlers ---
    const handlePointerDown = useCallback((clientX, clientY) => {
        startPointerRef.current = { x: clientX, y: clientY };
        dragDeltaRef.current = { x: 0, y: 0 };
        hasDraggedRef.current = false;
        setIsPointerDown(true);
    }, []);
    const handlePointerMove = useCallback((clientX, clientY) => {
        const dx = clientX - startPointerRef.current.x;
        const dy = clientY - startPointerRef.current.y;
        // Check threshold before committing to drag
        if (!isDraggingRef.current) {
            if (Math.abs(dx) < dragThreshold && Math.abs(dy) < dragThreshold)
                return;
            isDraggingRef.current = true;
            hasDraggedRef.current = true;
            setIsDragging(true);
        }
        const nav = navRef.current;
        if (!nav)
            return;
        const rawTotalX = offsetRef.current.x + dx;
        const rawTotalY = offsetRef.current.y + dy;
        nav.style.transform = `translate3d(${rawTotalX}px, ${rawTotalY}px, 0)`;
        // Clamp to viewport bounds
        const rect = nav.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let clampX = 0;
        let clampY = 0;
        if (rect.left < 0)
            clampX = -rect.left;
        else if (rect.right > vw)
            clampX = vw - rect.right;
        if (rect.top < 0)
            clampY = -rect.top;
        else if (rect.bottom > vh)
            clampY = vh - rect.bottom;
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
        let newMode = null;
        let newEdge = null;
        if (clampedLeft < edgeThreshold) {
            newMode = "vertical";
            newEdge = "left";
        }
        else if (clampedRight > vw - edgeThreshold) {
            newMode = "vertical";
            newEdge = "right";
        }
        else if (modeRef.current === "vertical" &&
            (clampedTop < edgeThreshold || clampedBottom > vh - edgeThreshold)) {
            newMode = "horizontal";
            newEdge = null;
        }
        // Snap to left/right edge -> vertical, center on Y axis
        if (newMode === "vertical" &&
            (newMode !== modeRef.current || newEdge !== edgeRef.current)) {
            isDraggingRef.current = false;
            setIsPointerDown(false);
            dragDeltaRef.current = { x: 0, y: 0 };
            snapToVertical(nav, newEdge);
        }
        // Push to top/bottom edge -> horizontal, center on X axis
        if (newMode === "horizontal" && modeRef.current === "vertical") {
            isDraggingRef.current = false;
            setIsPointerDown(false);
            dragDeltaRef.current = { x: 0, y: 0 };
            snapToHorizontal(nav);
        }
    }, [dragThreshold, edgeThreshold, snapToVertical, snapToHorizontal]);
    const handlePointerUp = useCallback(() => {
        setIsPointerDown(false);
        if (!isDraggingRef.current)
            return;
        isDraggingRef.current = false;
        const nav = navRef.current;
        if (!nav)
            return;
        // Commit this drag's delta into the persistent offset
        offsetRef.current = {
            x: offsetRef.current.x + dragDeltaRef.current.x,
            y: offsetRef.current.y + dragDeltaRef.current.y,
        };
        // Edge detection on release
        const rect = nav.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let newMode = null;
        let newEdge = null;
        if (rect.left < edgeThreshold) {
            newMode = "vertical";
            newEdge = "left";
        }
        else if (rect.right > vw - edgeThreshold) {
            newMode = "vertical";
            newEdge = "right";
        }
        else if (modeRef.current === "vertical" &&
            (rect.top < edgeThreshold || rect.bottom > vh - edgeThreshold)) {
            newMode = "horizontal";
            newEdge = null;
        }
        const edgeSwitch = newMode === "vertical" &&
            (newMode !== modeRef.current || newEdge !== edgeRef.current);
        const topBottomSwitch = newMode === "horizontal" && modeRef.current === "vertical";
        if (edgeSwitch) {
            snapToVertical(nav, newEdge);
        }
        else if (topBottomSwitch) {
            snapToHorizontal(nav);
        }
        else {
            flushSync(() => {
                setIsDragging(false);
            });
        }
    }, [edgeThreshold, snapToVertical, snapToHorizontal]);
    // Prevent clicks from firing after a drag
    const handleClickCapture = useCallback((e) => {
        if (hasDraggedRef.current) {
            e.preventDefault();
            e.stopPropagation();
            hasDraggedRef.current = false;
        }
    }, []);
    // Prevent browser native link/image drag
    const handleNativeDragStart = useCallback((e) => {
        e.preventDefault();
    }, []);
    // Mouse events on nav
    const onMouseDown = useCallback((e) => {
        handlePointerDown(e.clientX, e.clientY);
    }, [handlePointerDown]);
    const onTouchStart = useCallback((e) => {
        const touch = e.touches[0];
        handlePointerDown(touch.clientX, touch.clientY);
    }, [handlePointerDown]);
    // Global listeners (attached from pointer-down to pointer-up)
    useEffect(() => {
        if (!isPointerDown)
            return;
        const onMouseMove = (e) => handlePointerMove(e.clientX, e.clientY);
        const onTouchMove = (e) => handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
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
    };
}
//# sourceMappingURL=useDrag.js.map