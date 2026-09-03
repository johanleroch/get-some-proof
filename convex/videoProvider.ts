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

  if (!env.MUX_TOKEN_ID || !env.MUX_TOKEN_SECRET) {
    throw new Error(
      "MUX_TOKEN_ID and MUX_TOKEN_SECRET are required when MUX_PROVIDER=mux.",
    );
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
        passthrough: input.passthrough,
        playback_policies: ["public"],
        video_quality: "basic",
      },
      timeout: 7_200,
    }),
    headers: {
      Authorization: `Basic ${btoa(`${env.MUX_TOKEN_ID}:${env.MUX_TOKEN_SECRET}`)}`,
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
