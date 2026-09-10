import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cancelVideoDirectUpload,
  createVideoDirectUpload,
  deleteVideoAsset,
  createVideoAssetFromUrl,
  listMuxImportCandidates,
} from "./videoProvider";

describe("video upload provider", () => {
  it("classifies a connection interrupted while reading the creation response", async () => {
    vi.stubEnv("MUX_PROVIDER", "mux");
    vi.stubEnv("MUX_TOKEN_ID", "test-id");
    vi.stubEnv("MUX_TOKEN_SECRET", "test-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new TypeError("Response stream interrupted");
        },
      }),
    );
    await expect(
      createVideoDirectUpload({
        corsOrigin: "https://app.example",
        passthrough: "reserved-item",
        organizationId: "project",
        spokenLanguage: "en",
      }),
    ).rejects.toMatchObject({ transient: true });
  });
  it("classifies a temporary direct-upload outage so a later attempt can succeed", async () => {
    vi.stubEnv("MUX_PROVIDER", "mux");
    vi.stubEnv("MUX_TOKEN_ID", "test-id");
    vi.stubEnv("MUX_TOKEN_SECRET", "test-secret");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                id: "upload-retry",
                url: "https://upload.example/capability",
              },
            }),
          ),
        ),
    );
    const args = {
      corsOrigin: "https://app.example",
      passthrough: "reserved-item",
      organizationId: "project",
      spokenLanguage: "en" as const,
    };
    await expect(createVideoDirectUpload(args)).rejects.toMatchObject({
      transient: true,
    });
    await expect(createVideoDirectUpload(args)).resolves.toMatchObject({
      uploadId: "upload-retry",
    });
  });
  it("keeps the provider reserved for the copy if configuration changes", async () => {
    vi.stubEnv("MUX_PROVIDER", "mux");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createVideoAssetFromUrl({
        provider: "fake",
        url: "https://stream.mux.com/source123/high.mp4",
        passthrough: "reservation",
        organizationId: "project",
      }),
    ).resolves.toMatchObject({ provider: "fake", status: "accepted" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests a hosted copy of an allowed source and never labels it ready", async () => {
    vi.stubEnv("MUX_PROVIDER", "mux");
    vi.stubEnv("MUX_TOKEN_ID", "test-id");
    vi.stubEnv("MUX_TOKEN_SECRET", "test-secret");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          headers: { "content-length": "4096", "content-type": "video/mp4" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: "copied-asset" } }), {
          status: 201,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const result = await createVideoAssetFromUrl({
      url: "https://stream.mux.com/source123/high.mp4",
      passthrough: "opaque-reservation",
      organizationId: "opaque-project",
    });
    expect(result).toEqual({
      provider: "mux",
      status: "accepted",
      providerAssetId: "copied-asset",
      fileSizeBytes: 4096,
    });
    const body = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(body.inputs[0].url).toBe(
      "https://stream.mux.com/source123/high.mp4",
    );
    expect(body.passthrough).toBe("opaque-reservation");
    expect(body.playback_policies).toEqual(["public"]);
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      method: "HEAD",
      redirect: "error",
    });
  });

  it("does not retry an uncertain Mux creation response", async () => {
    vi.stubEnv("MUX_PROVIDER", "mux");
    vi.stubEnv("MUX_TOKEN_ID", "test-id");
    vi.stubEnv("MUX_TOKEN_SECRET", "test-secret");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          headers: { "content-length": "4096", "content-type": "video/mp4" },
        }),
      )
      .mockRejectedValueOnce(new Error("connection lost after sending"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createVideoAssetFromUrl({
        url: "https://stream.mux.com/source123/high.mp4",
        passthrough: "reservation",
        organizationId: "project",
      }),
    ).resolves.toMatchObject({ provider: "mux", status: "uncertain" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    "http://127.0.0.1/video.mp4",
    "https://stream.mux.com.evil.test/id/high.mp4",
    "https://stream.mux.com/id/high.mp4?token=private",
  ])("rejects an unsupported copy source: %s", async (url) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createVideoAssetFromUrl({
        url,
        passthrough: "reservation",
        organizationId: "project",
      }),
    ).rejects.toThrow("Video source unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([undefined, "536870913", "0"])(
    "refuses an unbounded or oversized source before creating an asset: %s",
    async (size) => {
      vi.stubEnv("MUX_PROVIDER", "mux");
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(null, {
          headers: size ? { "content-length": size } : {},
        }),
      );
      vi.stubGlobal("fetch", fetchMock);
      await expect(
        createVideoAssetFromUrl({
          url: "https://stream.mux.com/source123/high.mp4",
          passthrough: "reservation",
          organizationId: "project",
        }),
      ).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
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
        organizationId: "organization-1",
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
        organizationId: "organization-1",
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
            generated_subtitles: [{ language_code: "auto", name: "Captions" }],
          },
        ],
        passthrough: "reservation-1",
        meta: {
          title: "Témoignage vidéo · reservation-1",
          creator_id: "organization-1",
          external_id: "reservation-1",
        },
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

  it("refuses implicit provider selection", async () => {
    vi.stubEnv("MUX_PROVIDER", "");
    await expect(
      createVideoDirectUpload({
        corsOrigin: "http://localhost:3000",
        passthrough: "reservation-1",
        organizationId: "organization-1",
        spokenLanguage: "en",
      }),
    ).rejects.toThrow("MUX_PROVIDER must be explicitly set");
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

it("reads a bounded cursor page and preserves only correlation metadata", async () => {
  vi.stubEnv("MUX_TOKEN_ID", "test-id");
  vi.stubEnv("MUX_TOKEN_SECRET", "test-secret");
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        next_cursor: "next-page",
        data: [
          {
            id: "asset-a",
            passthrough: "reservation-a",
            meta: { title: "Private title" },
          },
          { id: "asset-b" },
        ],
      }),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  expect(await listMuxImportCandidates("opaque+cursor/value")).toEqual({
    assets: [
      { id: "asset-a", passthrough: "reservation-a" },
      { id: "asset-b" },
    ],
    nextCursor: "next-page",
  });
  const [url, options] = fetchMock.mock.calls[0];
  expect(url.origin).toBe("https://api.mux.com");
  expect(url.searchParams.get("cursor")).toBe("opaque+cursor/value");
  expect(url.searchParams.get("limit")).toBe("100");
  expect(options.redirect).toBe("error");
});

it("rejects unavailable, malformed and oversized inventory pages without treating them as empty", async () => {
  vi.stubEnv("MUX_TOKEN_ID", "test-id");
  vi.stubEnv("MUX_TOKEN_SECRET", "test-secret");
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 42 }] })))
    .mockResolvedValueOnce(new Response("x".repeat(1000001)));
  vi.stubGlobal("fetch", fetchMock);
  await expect(listMuxImportCandidates()).rejects.toThrow();
  await expect(listMuxImportCandidates()).rejects.toThrow();
  await expect(listMuxImportCandidates()).rejects.toThrow();
});
