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
                // The form no longer asks for a language. Legacy language
                // metadata must not override detection of the actual audio.
                language_code: "auto",
                name: "Captions",
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
