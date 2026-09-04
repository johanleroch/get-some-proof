import { beforeEach, describe, expect, it, vi } from "vitest";

const { abort, createUpload, handlers } = vi.hoisted(() => ({
  abort: vi.fn(),
  createUpload: vi.fn(),
  handlers: new Map<string, (event: { detail: unknown }) => void>(),
}));

vi.mock("@mux/upchunk", () => ({ createUpload }));

import { uploadDirectVideo } from "./video-upload";

describe("uploadDirectVideo", () => {
  beforeEach(() => {
    abort.mockClear();
    createUpload.mockReset();
    handlers.clear();
    createUpload.mockReturnValue({
      abort,
      on: (name: string, handler: (event: { detail: unknown }) => void) => {
        handlers.set(name, handler);
      },
    });
  });

  it("reports real progress and aborts an active upload", async () => {
    const controller = new AbortController();
    const onProgress = vi.fn();
    const result = uploadDirectVideo(
      new File(["video"], "story.mp4", { type: "video/mp4" }),
      {
        onProgress,
        provider: "mux",
        signal: controller.signal,
        uploadUrl: "https://mux.example/upload",
      },
    );

    handlers.get("progress")?.({ detail: 37 });
    expect(onProgress).toHaveBeenCalledWith(37);
    controller.abort();

    await expect(result).rejects.toThrow("Video upload cancelled.");
    expect(abort).toHaveBeenCalledOnce();
  });
});
