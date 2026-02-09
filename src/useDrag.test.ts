import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type React from "react";
import { useDrag } from "./useDrag";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock nav element whose getBoundingClientRect auto-computes
 * position from a base rect + the current CSS transform value.
 */
function createMockNav(
  baseRect: Partial<DOMRect> = {}
): HTMLElement {
  const nav = document.createElement("nav");
  const base = {
    left: 412,
    top: 16,
    right: 612,
    bottom: 56,
    width: 200,
    height: 40,
    x: 412,
    y: 16,
  };
  Object.assign(base, baseRect);

  nav.getBoundingClientRect = vi.fn(() => {
    let tx = 0;
    let ty = 0;
    const match = nav.style.transform.match(
      /translate3d\(\s*([^,]+)px,\s*([^,]+)px/
    );
    if (match) {
      tx = parseFloat(match[1]);
      ty = parseFloat(match[2]);
    }
    return {
      left: base.left + tx,
      top: base.top + ty,
      right: base.right + tx,
      bottom: base.bottom + ty,
      width: base.width,
      height: base.height,
      x: base.x + tx,
      y: base.y + ty,
      toJSON() {},
    } as DOMRect;
  });

  return nav;
}

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: height,
    writable: true,
    configurable: true,
  });
}

function attachNav(
  ref: React.RefObject<HTMLElement | null>,
  nav: HTMLElement
) {
  Object.defineProperty(ref, "current", {
    value: nav,
    writable: true,
    configurable: true,
  });
}

function mouseDown(
  hook: ReturnType<typeof useDrag>,
  x: number,
  y: number
) {
  hook.onMouseDown({ clientX: x, clientY: y } as React.MouseEvent);
}

function mouseMove(x: number, y: number) {
  window.dispatchEvent(
    new MouseEvent("mousemove", { clientX: x, clientY: y })
  );
}

function mouseUp() {
  window.dispatchEvent(new MouseEvent("mouseup"));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useDrag", () => {
  beforeEach(() => {
    setViewport(1024, 768);
    delete (document as any).startViewTransition;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1
  it("returns correct initial state", () => {
    const { result } = renderHook(() => useDrag());
    expect(result.current.mode).toBe("horizontal");
    expect(result.current.edge).toBeNull();
    expect(result.current.isDragging).toBe(false);
    expect(result.current.navRef).toBeDefined();
  });

  // 2
  it("does not activate drag below threshold", () => {
    const nav = createMockNav();
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    act(() => mouseDown(result.current, 500, 30));
    act(() => mouseMove(503, 32)); // ~3.6px < 5px threshold

    expect(result.current.isDragging).toBe(false);

    act(() => mouseUp());
  });

  // 3
  it("activates drag when movement exceeds threshold", () => {
    const nav = createMockNav();
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    act(() => mouseDown(result.current, 500, 30));
    act(() => mouseMove(506, 30)); // 6px > 5px threshold

    expect(result.current.isDragging).toBe(true);

    act(() => mouseUp());
  });

  // 4
  it("applies translate3d transform during drag", () => {
    const nav = createMockNav();
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    act(() => mouseDown(result.current, 500, 30));
    act(() => mouseMove(550, 50)); // +50x, +20y

    expect(nav.style.transform).toMatch(/translate3d\(\s*50px,\s*20px/);

    act(() => mouseUp());
  });

  // 5
  it("clamps position to viewport bounds", () => {
    const nav = createMockNav();
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    // Drag far down past bottom of viewport (no left/right edge snap)
    act(() => mouseDown(result.current, 500, 30));
    act(() => mouseMove(500, 780)); // +750 down

    const rect = nav.getBoundingClientRect();
    expect(rect.bottom).toBeLessThanOrEqual(768);

    act(() => mouseUp());
  });

  // 6
  it("snaps to vertical-left when dragged to left edge", () => {
    const nav = createMockNav();
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    // Drag 400px left → rect.left becomes 12, which is < 60 (edgeThreshold)
    act(() => mouseDown(result.current, 500, 30));
    act(() => mouseMove(100, 30));

    expect(result.current.mode).toBe("vertical");
    expect(result.current.edge).toBe("left");
    expect(result.current.isDragging).toBe(false);
  });

  // 7
  it("snaps to vertical-right when dragged to right edge", () => {
    const nav = createMockNav();
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    // Drag 400px right → rect.right becomes 1012, which is > 964 (1024-60)
    act(() => mouseDown(result.current, 500, 30));
    act(() => mouseMove(900, 30));

    expect(result.current.mode).toBe("vertical");
    expect(result.current.edge).toBe("right");
    expect(result.current.isDragging).toBe(false);
  });

  // 8
  it("snaps back to horizontal from vertical when dragged to top", () => {
    const nav = createMockNav();
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    // First: snap to left edge
    act(() => mouseDown(result.current, 500, 30));
    act(() => mouseMove(100, 30));
    expect(result.current.mode).toBe("vertical");

    // Replace nav to simulate vertical-left positioning.
    // After snap, offsetRef = { x: 0, y: centeredY - baseTop } where
    // centeredY = (768-40)/2 = 364, baseTop = 16 → offsetRef.y = 348.
    // Use same baseTop (16) so offset arithmetic stays consistent.
    const nav2 = createMockNav({ left: 8, right: 208, x: 8 });
    attachNav(result.current.navRef, nav2);

    // Drag from (50, 384) toward upper-right: (300, 10)
    // rawTotalX = 0 + 250 = 250, rawTotalY = 348 + (-374) = -26
    // rect: left = 8+250=258 (>60), top = 16-26 = -10 → clamped to 0 → <60 → horizontal!
    act(() => mouseDown(result.current, 50, 384));
    act(() => mouseMove(300, 10));

    expect(result.current.mode).toBe("horizontal");
    expect(result.current.edge).toBeNull();
  });

  // 9
  it("does not change mode on pointer up without drag", () => {
    const nav = createMockNav();
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    act(() => mouseDown(result.current, 500, 30));
    act(() => mouseUp());

    expect(result.current.mode).toBe("horizontal");
    expect(result.current.edge).toBeNull();
    expect(result.current.isDragging).toBe(false);
  });

  // 10
  it("commits offset on pointer up so next drag starts from there", () => {
    const nav = createMockNav();
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    // Drag 30px right (not near any edge)
    act(() => mouseDown(result.current, 500, 30));
    act(() => mouseMove(530, 30));
    act(() => mouseUp());

    // Start a second drag and move 0px — transform should reflect prior offset
    act(() => mouseDown(result.current, 530, 30));
    act(() => mouseMove(536, 30)); // just past threshold

    // Transform should include the first drag's 30px plus the new 6px = 36
    expect(nav.style.transform).toMatch(/translate3d\(\s*36px/);

    act(() => mouseUp());
  });

  // 11
  it("snaps to edge on pointer up when released near left edge", () => {
    // Use a small nav so that a moderate drag reaches the edge threshold
    const nav = createMockNav({ left: 100, right: 200, x: 100 });
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    // Drag left so rect.left falls below edgeThreshold (60)
    act(() => mouseDown(result.current, 150, 30));
    act(() => mouseMove(100, 30)); // dx=-50, rect.left = 100-50=50 < 60

    // The during-drag snap fires, setting mode to vertical
    expect(result.current.mode).toBe("vertical");
    expect(result.current.edge).toBe("left");
  });

  // 12
  it("suppresses click after drag", () => {
    const nav = createMockNav();
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    // Perform a drag (not near edge so no snap)
    act(() => mouseDown(result.current, 500, 30));
    act(() => mouseMove(530, 30));
    act(() => mouseUp());

    // Simulate click capture
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    act(() => {
      result.current.onClickCapture({
        preventDefault,
        stopPropagation,
      } as unknown as React.MouseEvent);
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
  });

  // 13
  it("prevents native drag start", () => {
    const { result } = renderHook(() => useDrag());
    const preventDefault = vi.fn();

    act(() => {
      result.current.onDragStart({
        preventDefault,
      } as unknown as React.DragEvent);
    });

    expect(preventDefault).toHaveBeenCalled();
  });

  // 14
  it("respects custom thresholds", () => {
    const nav = createMockNav();
    const { result } = renderHook(() =>
      useDrag({ edgeThreshold: 100, dragThreshold: 20 })
    );
    attachNav(result.current.navRef, nav);

    // 15px move should NOT start drag (threshold is 20)
    act(() => mouseDown(result.current, 500, 30));
    act(() => mouseMove(515, 30));
    expect(result.current.isDragging).toBe(false);

    // 21px move SHOULD start drag
    act(() => mouseMove(521, 30));
    expect(result.current.isDragging).toBe(true);

    act(() => mouseUp());

    // Snap with edgeThreshold=100: drag so rect.right > 1024-100 = 924
    // Base right is 612, need delta > 924 - 612 = 312
    act(() => mouseDown(result.current, 500, 30));
    act(() => mouseMove(840, 30)); // dx=340, offset from prior drag + 340

    expect(result.current.mode).toBe("vertical");
    expect(result.current.edge).toBe("right");
  });

  // 15
  it("calls document.startViewTransition during snap when available", () => {
    const nav = createMockNav();
    const mockVT = vi.fn((cb: () => void) => {
      cb();
      return { finished: Promise.resolve() };
    });
    (document as any).startViewTransition = mockVT;

    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    act(() => mouseDown(result.current, 500, 30));
    act(() => mouseMove(100, 30)); // snap to left

    expect(mockVT).toHaveBeenCalled();
    expect(result.current.mode).toBe("vertical");
  });
});
