import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cancelVideoDirectUpload,
  createVideoDownloadAsset,
  createVideoDirectUpload,
  deleteVideoAsset,
  getVideoDownloadUrl,
} from "./videoProvider";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const signingPrivateKey = Buffer.from(
  privateKey.export({ format: "pem", type: "pkcs8" }),
).toString("base64");

function stubSigningKey() {
  vi.stubEnv("MUX_SIGNING_KEY_ID", "mux-signing-key-id");
  vi.stubEnv("MUX_SIGNING_PRIVATE_KEY", signingPrivateKey);
}

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
        max_resolution_tier: "1080p",
        video_quality: "basic",
      },
      timeout: 7_200,
    });
    expect(request.headers).toMatchObject({
      Authorization: `Basic ${btoa("mux-token-id:mux-token-secret")}`,
      "Content-Type": "application/json",
    });
  });

  it("creates a separate signed 1080p download asset from public HLS", async () => {
    vi.stubEnv("MUX_PROVIDER", "mux");
    vi.stubEnv("MUX_TOKEN_ID", "mux-token-id");
    vi.stubEnv("MUX_TOKEN_SECRET", "mux-token-secret");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "download-asset-id",
            playback_ids: [{ id: "signed-download-id", policy: "signed" }],
          },
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createVideoDownloadAsset({ sourcePlaybackId: "public-source-id" }),
    ).resolves.toEqual({
      playbackId: "signed-download-id",
      providerAssetId: "download-asset-id",
    });
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toMatchObject({
      inputs: [{ url: "https://stream.mux.com/public-source-id.m3u8" }],
      max_resolution_tier: "1080p",
      playback_policies: ["signed"],
      static_renditions: [{ resolution: "highest" }],
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

  it("selects the best ready MP4 up to 1080p", async () => {
    vi.stubEnv("MUX_PROVIDER", "mux");
    vi.stubEnv("MUX_TOKEN_ID", "mux-token-id");
    vi.stubEnv("MUX_TOKEN_SECRET", "mux-token-secret");
    stubSigningKey();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              static_renditions: {
                files: [
                  { name: "2160p.mp4", resolution: "2160p", status: "ready" },
                  { name: "720p.mp4", resolution: "720p", status: "ready" },
                  { name: "1080p.mp4", resolution: "1080p", status: "ready" },
                ],
              },
            },
          }),
          { headers: { "Content-Type": "application/json" }, status: 200 },
        ),
      ),
    );

    await expect(
      getVideoDownloadUrl({
        playbackId: "signed-playback-id",
        provider: "mux",
        providerAssetId: "mux-asset-id",
      }),
    ).resolves.toMatch(
      /^https:\/\/stream\.mux\.com\/signed-playback-id\/1080p\.mp4\?token=.+&download=video-testimonial\.mp4$/,
    );
  });

  it("supports Mux's highest rendition filename under the 1080p upload cap", async () => {
    vi.stubEnv("MUX_PROVIDER", "mux");
    vi.stubEnv("MUX_TOKEN_ID", "mux-token-id");
    vi.stubEnv("MUX_TOKEN_SECRET", "mux-token-secret");
    stubSigningKey();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              static_renditions: {
                files: [
                  {
                    name: "highest.mp4",
                    resolution: "highest",
                    status: "ready",
                  },
                ],
              },
            },
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(
      getVideoDownloadUrl({
        playbackId: "signed-playback-id",
        provider: "mux",
        providerAssetId: "mux-asset-id",
      }),
    ).resolves.toMatch(
      /\/highest\.mp4\?token=.+&download=video-testimonial\.mp4$/,
    );
  });

  it("deletes the whole Mux asset and treats not-found as idempotent", async () => {
    vi.stubEnv("MUX_PROVIDER", "mux");
    vi.stubEnv("MUX_TOKEN_ID", "mux-token-id");
    vi.stubEnv("MUX_TOKEN_SECRET", "mux-token-secret");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteVideoAsset("mux-asset-id", "mux")).resolves.toBeNull();
    await expect(deleteVideoAsset("mux-asset-id", "mux")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.mux.com/video/v1/assets/mux-asset-id",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("cancels a Mux Direct Upload that cannot be attached", async () => {
    vi.stubEnv("MUX_PROVIDER", "mux");
    vi.stubEnv("MUX_TOKEN_ID", "mux-token-id");
    vi.stubEnv("MUX_TOKEN_SECRET", "mux-token-secret");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      cancelVideoDirectUpload("mux-upload-id", "mux"),
    ).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mux.com/video/v1/uploads/mux-upload-id/cancel",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("treats an already-cancelled Mux Direct Upload as idempotent", async () => {
    vi.stubEnv("MUX_PROVIDER", "mux");
    vi.stubEnv("MUX_TOKEN_ID", "mux-token-id");
    vi.stubEnv("MUX_TOKEN_SECRET", "mux-token-secret");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 400 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { status: "cancelled" } }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      cancelVideoDirectUpload("mux-upload-id", "mux"),
    ).resolves.toBeNull();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.mux.com/video/v1/uploads/mux-upload-id",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("treats a confirmed missing Direct Upload as already cleaned", async () => {
    vi.stubEnv("MUX_PROVIDER", "mux");
    vi.stubEnv("MUX_TOKEN_ID", "mux-token-id");
    vi.stubEnv("MUX_TOKEN_SECRET", "mux-token-secret");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      cancelVideoDirectUpload("missing-upload", "mux"),
    ).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("deletes the asset when a Direct Upload already created one", async () => {
    vi.stubEnv("MUX_PROVIDER", "mux");
    vi.stubEnv("MUX_TOKEN_ID", "mux-token-id");
    vi.stubEnv("MUX_TOKEN_SECRET", "mux-token-secret");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 400 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { asset_id: "created-asset", status: "asset_created" },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      cancelVideoDirectUpload("completed-upload", "mux"),
    ).resolves.toBeNull();
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.mux.com/video/v1/assets/created-asset",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
