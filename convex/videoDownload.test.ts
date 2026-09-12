import { afterEach, expect, it, vi } from "vitest";
import { prepareVideoDownload } from "./videoProvider";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("requests a temporary master MP4 when public playback has no download", async () => {
  vi.stubEnv("MUX_TOKEN_ID", "test");
  vi.stubEnv("MUX_TOKEN_SECRET", "test");
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ data: {} }))
    .mockResolvedValueOnce(
      Response.json({
        data: {
          master: {
            status: "ready",
            url: "https://mezzanine.mux.com/id/mezzanine.mp4?signature=test",
          },
        },
      }),
    );
  vi.stubGlobal("fetch", fetcher);
  expect(await prepareVideoDownload("asset")).toContain("mezzanine.mp4");
  expect(fetcher).toHaveBeenLastCalledWith(
    "https://api.mux.com/video/v1/assets/asset/master-access",
    expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ master_access: "temporary" }),
    }),
  );
});
it("rejects a master download pointing outside Mux", async () => {
  vi.stubEnv("MUX_TOKEN_ID", "test");
  vi.stubEnv("MUX_TOKEN_SECRET", "test");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        data: {
          master: { status: "ready", url: "http://127.0.0.1/private" },
        },
      }),
    ),
  );
  await expect(prepareVideoDownload("asset")).rejects.toThrow();
});
