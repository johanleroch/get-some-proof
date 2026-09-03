import { importPKCS8, SignJWT } from "jose";

import { env } from "./_generated/server";

export type VideoUploadProvider = "fake" | "mux";

export type DirectUpload = {
  provider: VideoUploadProvider;
  uploadId: string;
  uploadUrl: string;
};

function configuredProvider(): VideoUploadProvider {
  if (env.MUX_PROVIDER === "fake") return "fake";
  if (env.MUX_PROVIDER === "mux") return "mux";
  throw new Error("MUX_PROVIDER must be explicitly set to `fake` or `mux`.");
}

function muxAuthorization() {
  if (!env.MUX_TOKEN_ID || !env.MUX_TOKEN_SECRET) {
    throw new Error(
      "MUX_TOKEN_ID and MUX_TOKEN_SECRET are required when MUX_PROVIDER=mux.",
    );
  }
  return `Basic ${btoa(`${env.MUX_TOKEN_ID}:${env.MUX_TOKEN_SECRET}`)}`;
}

export async function createVideoDirectUpload(input: {
  corsOrigin: string;
  passthrough: string;
  spokenLanguage: "en" | "fr";
}): Promise<DirectUpload> {
  const provider = configuredProvider();
  if (provider === "fake") {
    const uploadId = `fake-upload-${crypto.randomUUID()}`;
    return {
      provider,
      uploadId,
      uploadUrl: `https://fake-mux.invalid/${uploadId}`,
    };
  }

  const response = await fetch("https://api.mux.com/video/v1/uploads", {
    body: JSON.stringify({
      cors_origin: input.corsOrigin,
      new_asset_settings: {
        inputs: [
          {
            generated_subtitles: [
              {
                language_code: input.spokenLanguage,
                name: `${input.spokenLanguage.toUpperCase()} captions`,
              },
            ],
          },
        ],
        max_resolution_tier: "1080p",
        passthrough: input.passthrough,
        playback_policies: ["public"],
        video_quality: "basic",
      },
      timeout: 7_200,
    }),
    headers: {
      Authorization: muxAuthorization(),
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Mux Direct Upload creation failed (${response.status}).`);
  }
  const body = (await response.json()) as {
    data?: { id?: unknown; url?: unknown };
  };
  if (typeof body.data?.id !== "string" || typeof body.data.url !== "string") {
    throw new Error("Mux Direct Upload response is invalid.");
  }
  return {
    provider,
    uploadId: body.data.id,
    uploadUrl: body.data.url,
  };
}

export async function createVideoDownloadAsset(input: {
  sourcePlaybackId: string;
}): Promise<{ playbackId: string; providerAssetId: string }> {
  const provider = configuredProvider();
  if (provider === "fake") {
    return {
      playbackId: `fake-download-${input.sourcePlaybackId}`,
      providerAssetId: `fake-download-asset-${input.sourcePlaybackId}`,
    };
  }
  const response = await fetch("https://api.mux.com/video/v1/assets", {
    body: JSON.stringify({
      inputs: [
        {
          url: `https://stream.mux.com/${encodeURIComponent(input.sourcePlaybackId)}.m3u8`,
        },
      ],
      max_resolution_tier: "1080p",
      playback_policies: ["signed"],
      static_renditions: [{ resolution: "highest" }],
      video_quality: "basic",
    }),
    headers: {
      Authorization: muxAuthorization(),
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Mux download asset creation failed (${response.status}).`);
  }
  const body = (await response.json()) as {
    data?: {
      id?: unknown;
      playback_ids?: Array<{ id?: unknown; policy?: unknown }>;
    };
  };
  const playbackId = body.data?.playback_ids?.find(
    (candidate) =>
      candidate.policy === "signed" && typeof candidate.id === "string",
  )?.id;
  if (typeof body.data?.id !== "string" || typeof playbackId !== "string") {
    throw new Error("Mux download asset response is invalid.");
  }
  return { playbackId, providerAssetId: body.data.id };
}

async function signVideoPlaybackToken(playbackId: string) {
  const keyId = env.MUX_SIGNING_KEY_ID;
  const encodedPrivateKey = env.MUX_SIGNING_PRIVATE_KEY;
  if (!keyId || !encodedPrivateKey) {
    throw new Error(
      "MUX_SIGNING_KEY_ID and MUX_SIGNING_PRIVATE_KEY are required for MP4 downloads.",
    );
  }
  const privateKey = await importPKCS8(atob(encodedPrivateKey), "RS256");
  return new SignJWT()
    .setProtectedHeader({ alg: "RS256", kid: keyId })
    .setSubject(playbackId)
    .setAudience("v")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

export async function cancelVideoDirectUpload(
  providerUploadId: string,
  provider: VideoUploadProvider,
) {
  if (provider === "fake") return null;
  const response = await fetch(
    `https://api.mux.com/video/v1/uploads/${encodeURIComponent(providerUploadId)}/cancel`,
    {
      headers: {
        Authorization: muxAuthorization(),
        "Content-Type": "application/json",
      },
      method: "PUT",
    },
  );
  if (response.ok) return null;
  const lookup = await fetch(
    `https://api.mux.com/video/v1/uploads/${encodeURIComponent(providerUploadId)}`,
    { headers: { Authorization: muxAuthorization() } },
  );
  if (lookup.status === 404) return null;
  if (lookup.ok) {
    const body = (await lookup.json()) as {
      data?: { asset_id?: unknown; status?: unknown };
    };
    if (
      body.data?.status === "cancelled" ||
      body.data?.status === "errored" ||
      body.data?.status === "timed_out"
    ) {
      return null;
    }
    if (
      body.data?.status === "asset_created" &&
      typeof body.data.asset_id === "string"
    ) {
      return deleteVideoAsset(body.data.asset_id, provider);
    }
  }
  throw new Error(
    `Mux Direct Upload cancellation failed (${response.status}).`,
  );
}

export async function getVideoDownloadUrl(input: {
  playbackId: string;
  provider: VideoUploadProvider;
  providerAssetId: string;
}) {
  if (input.provider === "fake") {
    return `https://fake-mux.invalid/${encodeURIComponent(input.playbackId)}/1080p.mp4?download=video-testimonial.mp4`;
  }
  const response = await fetch(
    `https://api.mux.com/video/v1/assets/${encodeURIComponent(input.providerAssetId)}`,
    { headers: { Authorization: muxAuthorization() } },
  );
  if (!response.ok) {
    throw new Error(`Mux asset lookup failed (${response.status}).`);
  }
  const body = (await response.json()) as {
    data?: {
      static_renditions?: {
        files?: Array<{
          name?: unknown;
          resolution?: unknown;
          status?: unknown;
        }>;
      };
    };
  };
  const maximumHeight = 1080;
  const renditionHeight = (file: { name?: unknown; resolution?: unknown }) => {
    if (file.resolution === "highest" || file.name === "highest.mp4") {
      return maximumHeight;
    }
    if (typeof file.resolution === "string" && /^\d+p$/.test(file.resolution)) {
      return Number.parseInt(file.resolution, 10);
    }
    return null;
  };
  const ready = (body.data?.static_renditions?.files ?? [])
    .filter(
      (file): file is { name: string; resolution?: unknown; status: "ready" } =>
        file.status === "ready" &&
        typeof file.name === "string" &&
        file.name.endsWith(".mp4") &&
        renditionHeight(file) !== null &&
        renditionHeight(file)! <= maximumHeight,
    )
    .sort((left, right) => renditionHeight(right)! - renditionHeight(left)!);
  const selected = ready[0];
  if (!selected) throw new Error("MP4 download is still processing.");
  const token = await signVideoPlaybackToken(input.playbackId);
  return `https://stream.mux.com/${encodeURIComponent(input.playbackId)}/${encodeURIComponent(selected.name)}?token=${encodeURIComponent(token)}&download=video-testimonial.mp4`;
}

export async function deleteVideoAsset(
  providerAssetId: string,
  provider: VideoUploadProvider,
) {
  if (provider === "fake") return null;
  const response = await fetch(
    `https://api.mux.com/video/v1/assets/${encodeURIComponent(providerAssetId)}`,
    {
      headers: { Authorization: muxAuthorization() },
      method: "DELETE",
    },
  );
  if (response.status !== 204 && response.status !== 404) {
    throw new Error(`Mux asset deletion failed (${response.status}).`);
  }
  return null;
}
