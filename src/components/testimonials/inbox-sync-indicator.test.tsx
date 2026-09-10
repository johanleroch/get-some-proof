// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InboxSyncIndicator } from "./inbox-sync-indicator";

const connection = vi.hoisted(() => ({ isWebSocketConnected: true }));
vi.mock("convex/react", () => ({
  useConvexConnectionState: () => connection,
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  connection.isWebSocketConnected = true;
});

it("only shows sustained activity, and clears immediately when finished", () => {
  vi.useFakeTimers();
  const view = render(<InboxSyncIndicator updating />);
  act(() => vi.advanceTimersByTime(299));
  expect(screen.queryByRole("status")).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("status").textContent).toContain(
    "Updating testimonials",
  );
  view.rerender(<InboxSyncIndicator updating={false} />);
  expect(screen.queryByRole("status")).toBeNull();
});

it("does not flash after a brief operation", () => {
  vi.useFakeTimers();
  const view = render(<InboxSyncIndicator updating />);
  act(() => vi.advanceTimersByTime(100));
  view.rerender(<InboxSyncIndicator updating={false} />);
  act(() => vi.advanceTimersByTime(500));
  expect(screen.queryByRole("status")).toBeNull();
});

it("signals a sustained disconnection and clears on reconnection", () => {
  vi.useFakeTimers();
  connection.isWebSocketConnected = false;
  const view = render(<InboxSyncIndicator updating={false} />);
  act(() => vi.advanceTimersByTime(300));
  expect(screen.getByRole("status").textContent).toContain(
    "Reconnecting to live testimonials",
  );
  connection.isWebSocketConnected = true;
  view.rerender(<InboxSyncIndicator updating={false} />);
  expect(screen.queryByRole("status")).toBeNull();
});
