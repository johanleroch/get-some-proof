import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useScreenStatuses } from "./use-screen-statuses";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(() => vi.unstubAllGlobals());

describe("screen status optimistic saves", () => {
  it("keeps other screens optimistic when an earlier response arrives or a save fails", async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useScreenStatuses({}), {
      wrapper: StrictMode,
    });
    let firstSave!: Promise<void>;
    let secondSave!: Promise<void>;
    act(() => {
      firstSave = result.current.updateStatus("one", "ok");
      secondSave = result.current.updateStatus("two", "todo");
    });
    expect(result.current.statuses).toEqual({ one: "ok", two: "todo" });
    await act(async () => {
      first.resolve(Response.json({ statuses: { one: "ok" } }));
      await firstSave;
    });
    expect(result.current.statuses).toEqual({ one: "ok", two: "todo" });
    await act(async () => {
      second.resolve(new Response(null, { status: 500 }));
      await secondSave;
    });
    expect(result.current.statuses).toEqual({ one: "ok" });
  });

  it("preserves the latest click and rolls it back to the last successful save", async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useScreenStatuses({ one: "todo" }), {
      wrapper: StrictMode,
    });
    let firstSave!: Promise<void>;
    let secondSave!: Promise<void>;
    act(() => {
      firstSave = result.current.updateStatus("one", "ok");
      secondSave = result.current.updateStatus("one", null);
    });
    expect(result.current.statuses).toEqual({});
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      first.resolve(Response.json({ statuses: { one: "ok" } }));
      await firstSave;
    });
    expect(result.current.statuses).toEqual({});
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      second.resolve(new Response(null, { status: 500 }));
      await secondSave;
    });
    expect(result.current.statuses).toEqual({ one: "ok" });
  });
});
