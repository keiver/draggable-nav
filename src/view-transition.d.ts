// View Transitions API type augmentation.
// These types may already exist in lib.dom.d.ts for TypeScript 5.4+.
// This file ensures compatibility with older TypeScript versions.

interface ViewTransition {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  skipTransition(): void;
}

interface Document {
  startViewTransition?(callback: () => void | Promise<void>): ViewTransition;
}
