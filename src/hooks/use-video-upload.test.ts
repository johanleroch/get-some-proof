import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  useVideoUpload,
  type VideoUploadReservation,
} from "./use-video-upload";

const file = new File(["video"], "proof.mp4", { type: "video/mp4" });

describe("Video Asset upload lifecycle", () => {
  afterEach(cleanup);

  it.each(["cancel", "unmount"])(
    "releases a reservation arriving after %s without starting transport",
    async (reason) => {
      let deliver!: (reservation: VideoUploadReservation) => void;
      const reserve = vi.fn(
        () =>
          new Promise<VideoUploadReservation>((resolve) => {
            deliver = resolve;
          }),
      );
      const release = vi.fn().mockResolvedValue(null);
      const upload = vi.fn();
      const { result, unmount } = renderHook(() => useVideoUpload());
      let pending!: Promise<boolean>;
      act(() => {
        pending = result.current.run({ file, reserve, upload });
      });
      const leaving = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(leaving);
      expect(leaving.defaultPrevented).toBe(true);
      // A double click must not acquire another reservation.
      await expect(result.current.run({ file, reserve, upload })).resolves.toBe(
        false,
      );
      if (reason === "unmount") unmount();
      else act(() => result.current.cancel());
      await act(async () => {
        deliver({ provider: "fake", uploadUrl: "fake://upload", release });
        expect(await pending).toBe(false);
      });
      expect(reserve).toHaveBeenCalledOnce();
      expect(release).toHaveBeenCalledOnce();
      expect(upload).not.toHaveBeenCalled();
      const after = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(after);
      expect(after.defaultPrevented).toBe(false);
    },
  );

  it("keeps cancellation authoritative even if transport resolves afterwards", async () => {
    let finish!: () => void;
    const upload = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const release = vi.fn().mockResolvedValue(null);
    const confirm = vi.fn();
    const { result } = renderHook(() => useVideoUpload());
    let pending!: Promise<boolean>;
    await act(async () => {
      pending = result.current.run({
        file,
        reserve: async () => ({
          provider: "fake",
          uploadUrl: "fake://upload",
          release,
        }),
        upload,
        confirm,
      });
    });
    await act(async () => {
      result.current.cancel();
      finish();
      expect(await pending).toBe(false);
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
    expect(result.current.hasReservation).toBe(false);
  });
});
