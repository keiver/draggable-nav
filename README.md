# draggable-nav

Draggable navigation bar for React. Snaps between horizontal (top) and vertical (edge) modes with View Transitions API support.

## Install

```bash
npm install github:keiver/draggable-nav#main
```

## Quick Start

```tsx
import { DraggableNav } from "draggable-nav";

function App() {
  return (
    <DraggableNav>
      {({ mode, edge, isDragging }) => (
        <>
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </>
      )}
    </DraggableNav>
  );
}
```

## API

### `<DraggableNav>`

Renders a fixed-position `<nav>` element that can be dragged around the viewport and snaps between horizontal and vertical orientations.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `(state: DragState) => ReactNode` | — | Render function receiving the current drag state |
| `className` | `string \| ((state: DragState) => string)` | — | Class name or function returning class name per state |
| `style` | `CSSProperties` | — | Merged with positioning defaults (overrides them) |
| `edgeThreshold` | `number` | `60` | Distance in px from viewport edge to trigger snap |
| `dragThreshold` | `number` | `5` | Min movement in px before drag activates |
| `ariaLabel` | `string` | `"Navigation"` | Accessible label for the nav element |

### `useDrag(options?)`

Low-level hook powering `<DraggableNav>`. Use this to build custom draggable navigation components.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `edgeThreshold` | `number` | `60` | Distance from edge to trigger snap |
| `dragThreshold` | `number` | `5` | Min px before drag activates |

**Returns:**

| Property | Type | Description |
|----------|------|-------------|
| `navRef` | `RefObject<HTMLElement>` | Attach to your nav element |
| `mode` | `"horizontal" \| "vertical"` | Current orientation |
| `edge` | `"left" \| "right" \| null` | Which edge the nav is snapped to |
| `isDragging` | `boolean` | Whether a drag is in progress |
| `onMouseDown` | `MouseEventHandler` | Attach to nav |
| `onTouchStart` | `TouchEventHandler` | Attach to nav |
| `onClickCapture` | `MouseEventHandler` | Attach to nav (suppresses click after drag) |
| `onDragStart` | `DragEventHandler` | Attach to nav (prevents native drag) |

### Types

```ts
type NavMode = "horizontal" | "vertical";
type NavEdge = "left" | "right" | null;

interface DragState {
  mode: NavMode;
  edge: NavEdge;
  isDragging: boolean;
}
```

## Behavior

- **Horizontal mode** — centered at top of viewport (`top: 1rem`, `left: 50%`)
- **Drag to left/right edge** — snaps to vertical mode, centered on Y axis
- **Drag vertical nav to top/bottom** — snaps back to horizontal mode
- **View Transitions API** — smooth animated snaps when supported, with `prefers-reduced-motion` fallback
- **Viewport clamping** — prevents dragging off-screen in any direction
- **Click suppression** — clicks are blocked after a drag to prevent accidental navigation

## Styling

The component uses CSS `translate` for centering (independent of the `transform` used during drag). This avoids conflicts between React-managed positioning and the hook's direct DOM manipulation.

```tsx
// Static class name
<DraggableNav className="my-nav">

// Dynamic class name based on state
<DraggableNav className={({ mode, isDragging }) =>
  `my-nav ${mode === "vertical" ? "sidebar" : ""} ${isDragging ? "dragging" : ""}`
}>

// Custom styles (merged with — and override — defaults)
<DraggableNav style={{ background: "rgba(0,0,0,0.8)", padding: "0.5rem" }}>
```

Built-in styles applied during drag:
- `cursor: grabbing` (default: `grab`)
- `willChange: transform`
- `contain: layout paint`

## Development

```bash
npm run build        # Compile TypeScript to dist/
npm test             # Run tests once
npm run test:watch   # Run tests in watch mode
```
