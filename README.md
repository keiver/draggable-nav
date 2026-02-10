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
| `keyboardStep` | `number` | `20` | Distance in px per arrow-key press (min 1) |
| `ariaLabel` | `string` | `"Navigation"` | Accessible label for the nav element |
| `viewTransitionName` | `string` | `"main-nav"` | CSS view-transition-name. Must be unique within the document if using View Transitions API elsewhere. |
| `announcements` | `{ dockedLeft?: string; dockedRight?: string; horizontal?: string }` | See below | Custom screen reader announcements for mode changes |
| `instructions` | `string` | `"Use arrow keys to reposition. Press Escape to reset."` | Keyboard instructions read by screen readers via `aria-describedby` |

### `useDrag(options?)`

Low-level hook powering `<DraggableNav>`. Use this to build custom draggable navigation components.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `edgeThreshold` | `number` | `60` | Distance from edge to trigger snap |
| `dragThreshold` | `number` | `5` | Min px before drag activates |
| `keyboardStep` | `number` | `20` | Px per arrow-key press (min 1) |

All numeric options are safely clamped: `NaN`, `Infinity`, and out-of-range values fall back to defaults.

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
| `onKeyDown` | `KeyboardEventHandler` | Attach to nav (arrow-key repositioning) |

### Types

```ts
type NavMode = "horizontal" | "vertical";
type NavEdge = "left" | "right" | null;

interface DragState {
  mode: NavMode;
  edge: NavEdge;
  isDragging: boolean;
}

interface UseDragOptions {
  edgeThreshold?: number;
  dragThreshold?: number;
  keyboardStep?: number;
}
```

## Behavior

- **Horizontal mode** — centered at top of viewport (`top: 1rem`, `left: 50%`)
- **Drag to left/right edge** — snaps to vertical mode, centered on Y axis
- **Drag vertical nav to top/bottom** — snaps back to horizontal mode
- **View Transitions API** — smooth animated snaps when supported, with `prefers-reduced-motion` fallback
- **Viewport clamping** — prevents dragging off-screen in any direction
- **Click suppression** — clicks are blocked after a drag to prevent accidental navigation

## Keyboard Support

The nav element is focusable (`tabIndex={0}`) and announces itself as `aria-roledescription="draggable"` to screen readers.

- **Tab** to the nav container to focus it
- **Arrow keys** reposition the nav by `keyboardStep` px per press
- **Escape** resets the nav to its default horizontal-center position
- Arrow keys only move the nav when the container itself is focused — child links inside the nav behave normally
- Keyboard movement triggers the same edge-snap logic as drag: left/right edges snap to vertical, top/bottom edges snap back to horizontal

## Accessibility

### Live region announcements

When the nav snaps to a new mode (horizontal or docked to an edge), a screen reader announcement is made via an `aria-live="polite"` region. Default announcements:

- **Docked left**: "Navigation docked to left edge"
- **Docked right**: "Navigation docked to right edge"
- **Horizontal**: "Navigation at top center"

Override these with the `announcements` prop:

```tsx
<DraggableNav
  announcements={{
    dockedLeft: "Menu moved to the side!",
    dockedRight: "Menu moved to the side!",
    horizontal: "Menu is at the top!",
  }}
>
```

### Keyboard instructions

The nav element has `aria-describedby` pointing to a visually-hidden element containing keyboard instructions. Screen readers will announce these when the nav receives focus. Override with the `instructions` prop:

```tsx
<DraggableNav instructions="Use arrow keys to move this menu!">
```

### Focus styling recommendation

The component does not apply focus-visible styles — add them via your own CSS:

```css
nav:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
```

### Kid-friendly configuration example

For children's platforms where motor control is less precise:

```tsx
<DraggableNav
  ariaLabel="Episodes"
  dragThreshold={8}
  announcements={{
    dockedLeft: "Menu moved to the side!",
    dockedRight: "Menu moved to the side!",
    horizontal: "Menu is at the top!",
  }}
  instructions="Use arrow keys to move this menu!"
>
  {({ mode }) => /* ... */}
</DraggableNav>
```

## Browser Compatibility

| Feature | Support |
|---------|---------|
| Core drag | All modern browsers |
| View Transitions | Chrome/Edge 111+ (graceful fallback) |
| CSS `translate` | Chrome 104+, Safari 14.1+, Firefox 72+ |

## SSR / React Server Components

- `"use client"` directive marks modules as client-only for RSC environments
- Module-level code has no global access — effects/callbacks only run on client
- Works with Next.js 13+ App Router, Remix, Gatsby (no SSR crash)

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

## Development

```bash
npm run build        # Compile TypeScript to dist/
npm test             # Run tests once
npm run test:watch   # Run tests in watch mode
```
