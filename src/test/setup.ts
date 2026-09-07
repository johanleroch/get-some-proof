import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

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
