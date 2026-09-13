import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useReviewBrowser } from "./use-review-browser";
import type { ReviewRead, ReviewUpdate } from "./types";

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
});

it("supports independent connectors with opaque resource paths and cursors", async () => {
  vi.useFakeTimers();
  const firstRead = vi.fn(
    async ({ selection, cursor }: ReviewRead) =>
      `${selection.join("/")}:${cursor ?? "first"}`,
  );
  const secondRead = vi.fn(async () => "second provider");
  const onError = vi.fn();
  const first = renderHook(() =>
    useReviewBrowser({
      connected: true,
      read: firstRead,
      update: null,
      onError,
    }),
  );
  const second = renderHook(() =>
    useReviewBrowser({
      connected: true,
      read: secondRead,
      update: null,
      onError,
    }),
  );
  act(() =>
    first.result.current.select({
      selection: ["tenant", "shop", "product"],
      cursor: "opaque cursor",
    }),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(first.result.current.page).toBe("tenant/shop/product:opaque cursor");
  expect(secondRead).not.toHaveBeenCalled();
  expect(second.result.current.page).toBeNull();
});

it("retries a failed notification refresh without another event and resets pagination", async () => {
  vi.useFakeTimers();
  const read = vi
    .fn()
    .mockResolvedValueOnce("initial")
    .mockRejectedValueOnce(new Error("temporary"))
    .mockResolvedValueOnce("updated");
  const onError = vi.fn();
  const hook = renderHook(
    ({ update }: { update: ReviewUpdate }) =>
      useReviewBrowser({ connected: true, read, update, onError }),
    { initialProps: { update: { selection: ["business"], revision: 0 } } },
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  hook.rerender({ update: { selection: ["business"], revision: 1 } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(hook.result.current.page).toBe("initial");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(hook.result.current.page).toBe("updated");
  expect(read).toHaveBeenLastCalledWith({
    selection: ["business"],
    cursor: undefined,
  });
  expect(onError).not.toHaveBeenCalled();
});

it("discards a slow previous selection", async () => {
  vi.useFakeTimers();
  let resolveOld!: (value: string) => void;
  const read = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveOld = resolve;
        }),
    )
    .mockResolvedValueOnce("new business");
  const onError = vi.fn();
  const hook = renderHook(() =>
    useReviewBrowser({ connected: true, read, update: null, onError }),
  );
  act(() => hook.result.current.select({ selection: ["old"] }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  act(() => hook.result.current.select({ selection: ["new"] }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  await act(async () => {
    resolveOld("obsolete");
  });
  expect(hook.result.current.page).toBe("new business");
  hook.unmount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });
  expect(read).toHaveBeenCalledTimes(2);
});

it("cancels a scheduled notification retry when unmounted", async () => {
  vi.useFakeTimers();
  const read = vi
    .fn()
    .mockResolvedValueOnce("initial")
    .mockRejectedValue(new Error("temporary"));
  const onError = vi.fn();
  const hook = renderHook(
    ({ update }: { update: ReviewUpdate }) =>
      useReviewBrowser({ connected: true, read, update, onError }),
    { initialProps: { update: { selection: ["business"], revision: 0 } } },
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  hook.rerender({ update: { selection: ["business"], revision: 1 } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(read).toHaveBeenCalledTimes(2);
  hook.unmount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });
  expect(read).toHaveBeenCalledTimes(2);
  expect(onError).not.toHaveBeenCalled();
});
