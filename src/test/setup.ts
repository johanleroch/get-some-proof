import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Testing Library only unmounts on its own when Vitest runs with globals, and
// this project does not. Without this, the last tree of every file stays
// mounted: React can still be scheduling work when the jsdom environment
// closes, which surfaces as an unhandled "window is not defined" and fails the
// run even though every test passed.
afterEach(cleanup);

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();

  return {
    ...actual,
    useRouter: () => ({
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
      push: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
    }),
  };
});

// Radix Select and pointer-driven primitives expect these DOM APIs, which
// jsdom does not implement.
if (typeof Element !== "undefined") {
  const prototype = Element.prototype as Element & {
    hasPointerCapture?: (pointerId: number) => boolean;
    releasePointerCapture?: (pointerId: number) => void;
    scrollIntoView?: (options?: unknown) => void;
    setPointerCapture?: (pointerId: number) => void;
  };
  prototype.hasPointerCapture ??= () => false;
  prototype.setPointerCapture ??= () => undefined;
  prototype.releasePointerCapture ??= () => undefined;
  prototype.scrollIntoView ??= () => undefined;
}

if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    disconnect() {}
    observe() {}
    unobserve() {}
  }
  globalThis.ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver;
}
