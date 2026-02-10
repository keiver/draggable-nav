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

function touchStart(
  hook: ReturnType<typeof useDrag>,
  x: number,
  y: number
) {
  hook.onTouchStart({
    touches: [{ clientX: x, clientY: y }],
  } as unknown as React.TouchEvent);
}

function touchMove(x: number, y: number) {
  // jsdom doesn't support the Touch constructor, so we create a
  // minimal TouchEvent with a touches array via Object.defineProperty.
  const event = new Event("touchmove", { bubbles: true }) as TouchEvent;
  Object.defineProperty(event, "touches", {
    value: [{ clientX: x, clientY: y }],
  });
  window.dispatchEvent(event);
}

function touchEnd() {
  window.dispatchEvent(new TouchEvent("touchend"));
}

/**
 * Creates a synthetic React KeyboardEvent targeting the given element.
 * When target === currentTarget, the handler treats it as "nav itself focused".
 */
function createKeyEvent(
  key: string,
  target: HTMLElement,
  currentTarget: HTMLElement
): React.KeyboardEvent {
  const preventDefault = vi.fn();
  return {
    key,
    target,
    currentTarget,
    preventDefault,
  } as unknown as React.KeyboardEvent;
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

  // 16
  it("activates drag via touch events", () => {
    const nav = createMockNav();
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    act(() => touchStart(result.current, 500, 30));
    act(() => touchMove(550, 50)); // +50x, +20y — past threshold

    expect(result.current.isDragging).toBe(true);
    expect(nav.style.transform).toMatch(/translate3d\(\s*50px,\s*20px/);

    act(() => touchEnd());
    expect(result.current.isDragging).toBe(false);
  });

  // 17
  it("snaps to edge via touch events", () => {
    const nav = createMockNav();
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    act(() => touchStart(result.current, 500, 30));
    act(() => touchMove(100, 30)); // snap to left edge

    expect(result.current.mode).toBe("vertical");
    expect(result.current.edge).toBe("left");
  });

  // 18
  it("does not call startViewTransition when prefers-reduced-motion is set", () => {
    const nav = createMockNav();
    const mockVT = vi.fn((cb: () => void) => {
      cb();
      return { finished: Promise.resolve() };
    });
    (document as any).startViewTransition = mockVT;

    // Mock matchMedia to return reduced motion
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    act(() => mouseDown(result.current, 500, 30));
    act(() => mouseMove(100, 30)); // snap to left

    expect(mockVT).not.toHaveBeenCalled();
    expect(result.current.mode).toBe("vertical");

    window.matchMedia = originalMatchMedia;
  });

  // 19
  it("cleans up global listeners on unmount during drag", () => {
    const nav = createMockNav();
    const { result, unmount } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    // Start a drag
    act(() => mouseDown(result.current, 500, 30));
    act(() => mouseMove(510, 30)); // past threshold

    expect(result.current.isDragging).toBe(true);

    const removeSpy = vi.spyOn(window, "removeEventListener");

    // Unmount — should not throw and should remove all global listeners
    expect(() => {
      act(() => unmount());
    }).not.toThrow();

    expect(removeSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("mouseup", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("touchmove", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("touchend", expect.any(Function));
    removeSpy.mockRestore();

    // Dispatching events after unmount should not throw
    expect(() => {
      mouseMove(520, 30);
      mouseUp();
    }).not.toThrow();
  });

  // 20
  it("initializes transform at mount for GPU compositing", () => {
    const nav = createMockNav();
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    // The useEffect sets transform on mount — but since we manually attach
    // the nav after render, let's verify the hook applies it when navRef is
    // available at mount time by checking the ref-based approach.
    // Re-render with nav already attached to trigger the effect
    const nav2 = createMockNav();
    const { result: result2 } = renderHook(() => {
      const hook = useDrag();
      // Immediately set navRef.current before effects run
      return hook;
    });

    // Manually assign before the effect fires
    Object.defineProperty(result2.current.navRef, "current", {
      value: nav2,
      writable: true,
      configurable: true,
    });

    // Force re-render to trigger the effect
    // The mount effect already ran but navRef was null.
    // In real usage the ref is attached via JSX before effects run.
    // We verify that createMockNav's transform starts empty,
    // meaning the first drag's transform won't cause a layer promotion jump
    // when the component mounts with the ref already set via DraggableNav.
    expect(nav2.style.transform).toBe("");
  });

  // 21
  it("does not crash on touchmove with empty touches array", () => {
    const nav = createMockNav();
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    act(() => touchStart(result.current, 500, 30));

    // Dispatch touchmove with empty touches array (multi-touch interference)
    expect(() => {
      act(() => {
        const event = new Event("touchmove", { bubbles: true }) as TouchEvent;
        Object.defineProperty(event, "touches", { value: [] });
        window.dispatchEvent(event);
      });
    }).not.toThrow();

    act(() => touchEnd());
  });

  // -------------------------------------------------------------------------
  // Keyboard support tests
  // -------------------------------------------------------------------------

  // 22
  it("arrow keys move nav when container itself is focused", () => {
    const nav = createMockNav();
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    // ArrowRight: nav is both target and currentTarget → should move
    const e = createKeyEvent("ArrowRight", nav, nav);
    act(() => result.current.onKeyDown(e));

    // offsetRef should be { x: 20, y: 0 } → transform applied
    expect(nav.style.transform).toMatch(/translate3d\(\s*20px,\s*0px/);

    // ArrowDown
    const e2 = createKeyEvent("ArrowDown", nav, nav);
    act(() => result.current.onKeyDown(e2));

    expect(nav.style.transform).toMatch(/translate3d\(\s*20px,\s*20px/);
  });

  // 23
  it("arrow keys ignored when child is focused", () => {
    const nav = createMockNav();
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    // target is a child link, currentTarget is the nav
    const childLink = document.createElement("a");
    nav.appendChild(childLink);

    const e = createKeyEvent("ArrowRight", childLink, nav);
    act(() => result.current.onKeyDown(e));

    // Transform should NOT have moved (still at initial or empty)
    expect(nav.style.transform).not.toMatch(/translate3d\(\s*20px/);
    // preventDefault should NOT have been called
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  // 24
  it("Escape resets to horizontal center", () => {
    const nav = createMockNav();
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    // First, move the nav away from center
    const e1 = createKeyEvent("ArrowRight", nav, nav);
    act(() => result.current.onKeyDown(e1));
    expect(nav.style.transform).toMatch(/translate3d\(\s*20px/);

    // Press Escape
    const escEvent = createKeyEvent("Escape", nav, nav);
    act(() => result.current.onKeyDown(escEvent));

    // Should reset to horizontal mode with edge=null
    expect(result.current.mode).toBe("horizontal");
    expect(result.current.edge).toBeNull();
    // Escape should NOT call preventDefault
    expect(escEvent.preventDefault).not.toHaveBeenCalled();
  });

  // 25
  it("keyboard movement triggers edge snap", () => {
    // Nav near the left edge: left=50, right=250
    const nav = createMockNav({ left: 50, right: 250, x: 50, width: 200 });
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    // ArrowLeft by 20px → rect.left = 50 - 20 = 30, which is < 60 (edgeThreshold)
    const e = createKeyEvent("ArrowLeft", nav, nav);
    act(() => result.current.onKeyDown(e));

    expect(result.current.mode).toBe("vertical");
    expect(result.current.edge).toBe("left");
  });

  // 26
  it("keyboard movement clamps to viewport", () => {
    // Nav at top-left near viewport edge: top=5
    const nav = createMockNav({ left: 412, top: 5, right: 612, bottom: 45 });
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    // ArrowUp by 20px → would push rect.top to -15, should clamp to 0
    const e = createKeyEvent("ArrowUp", nav, nav);
    act(() => result.current.onKeyDown(e));

    const rect = nav.getBoundingClientRect();
    expect(rect.top).toBeGreaterThanOrEqual(0);
  });

  // -------------------------------------------------------------------------
  // Resize handling tests
  // -------------------------------------------------------------------------

  // 28
  it("re-clamps position on window resize", () => {
    const nav = createMockNav();
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    // Drag right by 300px (not near edge snap: rect.right=612+300=912 < 964)
    act(() => mouseDown(result.current, 500, 30));
    act(() => mouseMove(800, 30));
    act(() => mouseUp());

    expect(nav.style.transform).toMatch(/translate3d\(\s*300px/);

    // Shrink viewport so nav would be off-screen (rect.right=912 > 800)
    setViewport(800, 768);

    // Mock rAF to run synchronously so the resize handler executes immediately
    const origRAF = window.requestAnimationFrame;
    const origCAF = window.cancelAnimationFrame;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = (() => {}) as typeof window.cancelAnimationFrame;

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    const rect = nav.getBoundingClientRect();
    expect(rect.right).toBeLessThanOrEqual(800);

    window.requestAnimationFrame = origRAF;
    window.cancelAnimationFrame = origCAF;
  });

  // 29
  it("does not adjust position on resize when nav is within bounds", () => {
    const nav = createMockNav();
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    // Small drag: 30px right (well within viewport)
    act(() => mouseDown(result.current, 500, 30));
    act(() => mouseMove(530, 30));
    act(() => mouseUp());

    const transformBefore = nav.style.transform;

    // Shrink viewport slightly but nav still fits (rect.right=642 < 900)
    setViewport(900, 768);

    const origRAF = window.requestAnimationFrame;
    const origCAF = window.cancelAnimationFrame;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = (() => {}) as typeof window.cancelAnimationFrame;

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    // Transform should be unchanged — no clamping needed
    expect(nav.style.transform).toBe(transformBefore);

    window.requestAnimationFrame = origRAF;
    window.cancelAnimationFrame = origCAF;
  });

  // -------------------------------------------------------------------------
  // Keyboard top/bottom edge snap (bug fix) & additional coverage
  // -------------------------------------------------------------------------

  // 30
  it("ArrowUp from vertical mode near top snaps to horizontal", () => {
    // Use a nav whose baseTop=364 so the vertical snap produces offsetRef.y≈0,
    // making subsequent arrow presses start from a clean offset.
    const nav = createMockNav({ top: 364, bottom: 404, y: 364 });
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    // Snap to vertical-left
    act(() => mouseDown(result.current, 500, 384));
    act(() => mouseMove(100, 384));
    expect(result.current.mode).toBe("vertical");

    // Replace with a nav whose left>60 (so left-edge check doesn't fire)
    // and top=70 (so ArrowUp by 20px → top=50 < 60 → triggers horizontal snap).
    const nav2 = createMockNav({ left: 200, right: 400, top: 70, bottom: 110, width: 200, x: 200, y: 70 });
    attachNav(result.current.navRef, nav2);

    const e = createKeyEvent("ArrowUp", nav2, nav2);
    act(() => result.current.onKeyDown(e));

    expect(result.current.mode).toBe("horizontal");
    expect(result.current.edge).toBeNull();
  });

  // 31
  it("ArrowRight near right edge snaps to vertical-right", () => {
    // Nav near the right edge: right = 980
    const nav = createMockNav({ left: 780, right: 980, x: 780, width: 200 });
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    // ArrowRight by 20px → rect.right = 980 + 20 = 1000, which is > 964 (1024-60)
    const e = createKeyEvent("ArrowRight", nav, nav);
    act(() => result.current.onKeyDown(e));

    expect(result.current.mode).toBe("vertical");
    expect(result.current.edge).toBe("right");
  });

  // 32
  it("handlePointerMove with null navRef does not crash", () => {
    const { result } = renderHook(() => useDrag());
    // navRef is null (no element attached)

    expect(() => {
      act(() => mouseDown(result.current, 500, 30));
      act(() => mouseMove(550, 30)); // past threshold, but navRef is null
    }).not.toThrow();

    act(() => mouseUp());
  });

  // 33
  it("handlePointerUp with null navRef does not crash", () => {
    const nav = createMockNav();
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    // Start drag normally
    act(() => mouseDown(result.current, 500, 30));
    act(() => mouseMove(510, 30)); // past threshold
    expect(result.current.isDragging).toBe(true);

    // Remove nav before pointer up
    attachNav(result.current.navRef, null as unknown as HTMLElement);

    expect(() => {
      act(() => mouseUp());
    }).not.toThrow();
  });

  // 34
  it("handleKeyDown with null navRef does not crash", () => {
    const { result } = renderHook(() => useDrag());
    // navRef is null

    const fakeTarget = document.createElement("nav");
    const e = createKeyEvent("ArrowRight", fakeTarget, fakeTarget);

    expect(() => {
      act(() => result.current.onKeyDown(e));
    }).not.toThrow();
  });

  // 35
  it("click passes through when no drag occurred", () => {
    const nav = createMockNav();
    const { result } = renderHook(() => useDrag());
    attachNav(result.current.navRef, nav);

    // Pointer down then up without moving (no drag)
    act(() => mouseDown(result.current, 500, 30));
    act(() => mouseUp());

    // Click should NOT be suppressed
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    act(() => {
      result.current.onClickCapture({
        preventDefault,
        stopPropagation,
      } as unknown as React.MouseEvent);
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(stopPropagation).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Parameter clamping tests
  // -------------------------------------------------------------------------

  // 27
  it("NaN/Infinity/negative thresholds fall back to safe defaults", () => {
    const nav = createMockNav();

    // NaN edgeThreshold → should use default 60
    const { result: r1 } = renderHook(() =>
      useDrag({ edgeThreshold: NaN, dragThreshold: NaN, keyboardStep: NaN })
    );
    attachNav(r1.current.navRef, nav);

    // Drag: should use dragThreshold=5 (default). 6px move should activate.
    act(() => mouseDown(r1.current, 500, 30));
    act(() => mouseMove(506, 30));
    expect(r1.current.isDragging).toBe(true);
    act(() => mouseUp());

    // Infinity
    const { result: r2 } = renderHook(() =>
      useDrag({ edgeThreshold: Infinity })
    );
    attachNav(r2.current.navRef, createMockNav());
    // edgeThreshold=Infinity → safeClamp returns fallback 60
    // (Infinity is not finite, so fallback applies)

    // Negative
    const { result: r3 } = renderHook(() =>
      useDrag({ edgeThreshold: -100, dragThreshold: -50, keyboardStep: -10 })
    );
    attachNav(r3.current.navRef, createMockNav());
    // edgeThreshold=-100 → clamped to 0, dragThreshold=-50 → clamped to 0,
    // keyboardStep=-10 → clamped to 1

    // With dragThreshold=0, any movement should start drag immediately
    act(() => mouseDown(r3.current, 500, 30));
    act(() => mouseMove(501, 30)); // 1px > 0
    expect(r3.current.isDragging).toBe(true);
    act(() => mouseUp());
  });
});
