import { afterEach, describe, expect, it, vi } from "vitest";

import { createVideoDirectUpload } from "./videoProvider";

describe("video upload provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses an explicit fake provider without an external request", async () => {
    vi.stubEnv("MUX_PROVIDER", "fake");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createVideoDirectUpload({
        corsOrigin: "http://localhost:3000",
        passthrough: "reservation-1",
        spokenLanguage: "fr",
      }),
    ).resolves.toMatchObject({ provider: "fake" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates a browser-scoped Mux Direct Upload with public playback and captions", async () => {
    vi.stubEnv("MUX_PROVIDER", "mux");
    vi.stubEnv("MUX_TOKEN_ID", "mux-token-id");
    vi.stubEnv("MUX_TOKEN_SECRET", "mux-token-secret");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "mux-upload-1",
            url: "https://storage.googleapis.com/video-upload",
          },
        }),
        { headers: { "Content-Type": "application/json" }, status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createVideoDirectUpload({
        corsOrigin: "https://proof.example",
        passthrough: "reservation-1",
        spokenLanguage: "fr",
      }),
    ).resolves.toEqual({
      provider: "mux",
      uploadId: "mux-upload-1",
      uploadUrl: "https://storage.googleapis.com/video-upload",
    });
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toEqual({
      cors_origin: "https://proof.example",
      new_asset_settings: {
        inputs: [
          {
            generated_subtitles: [{ language_code: "fr", name: "FR captions" }],
          },
        ],
        passthrough: "reservation-1",
        playback_policies: ["public"],
        video_quality: "basic",
      },
      timeout: 7_200,
    });
    expect(request.headers).toMatchObject({
      Authorization: `Basic ${btoa("mux-token-id:mux-token-secret")}`,
      "Content-Type": "application/json",
    });
  });

  it("refuses implicit provider selection", async () => {
    vi.stubEnv("MUX_PROVIDER", "");
    await expect(
      createVideoDirectUpload({
        corsOrigin: "http://localhost:3000",
        passthrough: "reservation-1",
        spokenLanguage: "en",
      }),
    ).rejects.toThrow("MUX_PROVIDER must be explicitly set");
  });
});
