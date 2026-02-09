import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DraggableNav } from "./DraggableNav";
import type { DragState } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/**
 * Mocks getBoundingClientRect on a DOM element with a dynamic rect
 * that reflects the current CSS transform.
 */
function mockNavRect(
  nav: HTMLElement,
  base: { left: number; top: number; width: number; height: number }
) {
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
      right: base.left + base.width + tx,
      bottom: base.top + base.height + ty,
      width: base.width,
      height: base.height,
      x: base.left + tx,
      y: base.top + ty,
      toJSON() {},
    } as DOMRect;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DraggableNav", () => {
  beforeEach(() => {
    setViewport(1024, 768);
    delete (document as any).startViewTransition;
  });

  // 1
  it("renders a nav element with aria-label", () => {
    render(
      <DraggableNav>{() => <span>child</span>}</DraggableNav>
    );

    const nav = screen.getByRole("navigation");
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveAttribute("aria-label", "Navigation");
  });

  // 2
  it("passes initial state to children render function", () => {
    let receivedState: DragState | null = null;

    render(
      <DraggableNav>
        {(state) => {
          receivedState = state;
          return <span>child</span>;
        }}
      </DraggableNav>
    );

    expect(receivedState).toEqual({
      mode: "horizontal",
      edge: null,
      isDragging: false,
    });
  });

  // 3
  it("applies horizontal positioning styles by default", () => {
    render(
      <DraggableNav>{() => <span>child</span>}</DraggableNav>
    );

    const nav = screen.getByRole("navigation");
    expect(nav.style.position).toBe("fixed");
    expect(nav.style.top).toBe("1rem");
    expect(nav.style.left).toBe("50%");
    expect(nav.style.translate).toBe("-50% 0");
    expect(nav.style.zIndex).toBe("1000");
    expect(nav.style.flexDirection).toBe("row");
  });

  // 4
  it("applies className when passed as string", () => {
    render(
      <DraggableNav className="my-nav">
        {() => <span>child</span>}
      </DraggableNav>
    );

    const nav = screen.getByRole("navigation");
    expect(nav.className).toBe("my-nav");
  });

  // 5
  it("calls className function with drag state", () => {
    const classNameFn = vi.fn(
      (state: DragState) => `nav-${state.mode}`
    );

    render(
      <DraggableNav className={classNameFn}>
        {() => <span>child</span>}
      </DraggableNav>
    );

    expect(classNameFn).toHaveBeenCalledWith({
      mode: "horizontal",
      edge: null,
      isDragging: false,
    });

    const nav = screen.getByRole("navigation");
    expect(nav.className).toBe("nav-horizontal");
  });

  // 6
  it("merges custom style prop with positioning defaults", () => {
    render(
      <DraggableNav style={{ background: "red", zIndex: 9999 }}>
        {() => <span>child</span>}
      </DraggableNav>
    );

    const nav = screen.getByRole("navigation");
    expect(nav.style.background).toBe("red");
    // Consumer style overrides defaults
    expect(nav.style.zIndex).toBe("9999");
    // Default position is still applied
    expect(nav.style.position).toBe("fixed");
  });

  // 7
  it("applies custom ariaLabel", () => {
    render(
      <DraggableNav ariaLabel="Episode navigation">
        {() => <span>child</span>}
      </DraggableNav>
    );

    const nav = screen.getByRole("navigation");
    expect(nav).toHaveAttribute("aria-label", "Episode navigation");
  });

  // 8
  it("includes viewTransitionName in style", () => {
    render(
      <DraggableNav>{() => <span>child</span>}</DraggableNav>
    );

    const nav = screen.getByRole("navigation");
    expect(nav.style.viewTransitionName).toBe("main-nav");
  });

  // 9
  it("applies grabbing cursor and willChange when dragging", () => {
    render(
      <DraggableNav>{() => <span>child</span>}</DraggableNav>
    );

    const nav = screen.getByRole("navigation");
    mockNavRect(nav, { left: 412, top: 16, width: 200, height: 40 });

    // Start drag
    act(() => {
      nav.dispatchEvent(
        new MouseEvent("mousedown", {
          clientX: 500,
          clientY: 30,
          bubbles: true,
        })
      );
    });

    // Move past drag threshold (>5px) but not near any edge
    act(() => {
      window.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 530, clientY: 30 })
      );
    });

    expect(nav.style.cursor).toBe("grabbing");
    expect(nav.style.willChange).toBe("transform");

    // Clean up
    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup"));
    });
  });

  // 10
  it("renders children that respond to mode changes", () => {
    render(
      <DraggableNav>
        {({ mode, edge }) => (
          <div data-testid="pills">
            <span data-testid="mode">{mode}</span>
            <span data-testid="edge">{edge ?? "none"}</span>
            <a href="/ep1">Episode 1</a>
            <a href="/ep2">Episode 2</a>
          </div>
        )}
      </DraggableNav>
    );

    expect(screen.getByTestId("mode").textContent).toBe("horizontal");
    expect(screen.getByTestId("edge").textContent).toBe("none");
    expect(screen.getByText("Episode 1")).toBeInTheDocument();
    expect(screen.getByText("Episode 2")).toBeInTheDocument();

    // Trigger snap to left edge
    const nav = screen.getByRole("navigation");
    mockNavRect(nav, { left: 412, top: 16, width: 200, height: 40 });

    act(() => {
      nav.dispatchEvent(
        new MouseEvent("mousedown", {
          clientX: 500,
          clientY: 30,
          bubbles: true,
        })
      );
    });

    act(() => {
      window.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 100, clientY: 30 })
      );
    });

    expect(screen.getByTestId("mode").textContent).toBe("vertical");
    expect(screen.getByTestId("edge").textContent).toBe("left");
    expect(nav.style.flexDirection).toBe("column");
  });
});
