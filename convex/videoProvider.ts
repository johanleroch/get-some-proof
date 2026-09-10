import { env } from "./_generated/server";

export class VideoProviderError extends Error {
  constructor(readonly transient: boolean) {
    super(
      "The video provider is temporarily unavailable or rejected the upload.",
    );
  }
}

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

export async function createVideoAssetFromUrl(input: {
  provider?: VideoUploadProvider;
  url: string;
  passthrough: string;
  organizationId: string;
}): Promise<{
  provider: VideoUploadProvider;
  status: "accepted" | "uncertain";
  providerAssetId?: string;
  fileSizeBytes?: number;
}> {
  const source = URL.parse(input.url);
  if (
    !source ||
    source.protocol !== "https:" ||
    source.hostname !== "stream.mux.com" ||
    source.username ||
    source.password ||
    source.port ||
    source.search ||
    source.hash ||
    !/^\/[a-zA-Z0-9]+\/[a-zA-Z0-9_-]+\.mp4$/.test(source.pathname)
  ) {
    throw new Error("Video source unavailable.");
  }
  const provider = input.provider ?? configuredProvider();
  if (provider === "fake")
    return {
      provider,
      status: "accepted",
      providerAssetId: `fake-import-${input.passthrough}`,
    };
  // Bound the source before asking the provider to retrieve it. Unknown sizes
  // remain unavailable rather than turning an import into an unbounded fetch.
  const metadata = await fetch(source.href, {
    method: "HEAD",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  const fileSizeBytes = Number(metadata.headers.get("content-length"));
  if (
    !metadata.ok ||
    !Number.isSafeInteger(fileSizeBytes) ||
    fileSizeBytes <= 0 ||
    fileSizeBytes > 512 * 1024 * 1024 ||
    metadata.headers.get("content-type")?.split(";", 1)[0]?.trim() !==
      "video/mp4"
  ) {
    throw new Error("Video source unavailable or larger than 512 MB.");
  }
  const authorization = muxAuthorization();
  let response: Response;
  try {
    response = await fetch("https://api.mux.com/video/v1/assets", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: [
          {
            url: source.href,
            generated_subtitles: [{ language_code: "auto", name: "Captions" }],
          },
        ],
        passthrough: input.passthrough,
        meta: {
          creator_id: input.organizationId,
          external_id: input.passthrough,
        },
        playback_policies: ["public"],
        video_quality: "basic",
        max_resolution_tier: "1080p",
      }),
    });
  } catch {
    // The POST may already have succeeded. Its passthrough lets a webhook
    // reconcile the reserved record; never retry this non-idempotent request.
    return { provider, status: "uncertain", fileSizeBytes };
  }
  if (response.status >= 500)
    return { provider, status: "uncertain", fileSizeBytes };
  if (!response.ok)
    throw new Error(`Video copy was rejected (${response.status}).`);
  try {
    const body: unknown = await response.json();
    const data =
      body && typeof body === "object" && "data" in body ? body.data : null;
    const id =
      data && typeof data === "object" && "id" in data ? data.id : null;
    if (typeof id === "string" && id)
      return {
        provider,
        status: "accepted",
        providerAssetId: id,
        fileSizeBytes,
      };
  } catch {
    /* A missing response body does not prove the creation failed. */
  }
  return { provider, status: "uncertain", fileSizeBytes };
}

export async function createVideoDirectUpload(input: {
  corsOrigin: string;
  passthrough: string;
  organizationId: string;
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
        // These fields can be public through the player: use opaque references,
        // never submitter identity or private management/retry tokens.
        meta: {
          title: `Témoignage vidéo · ${input.passthrough}`,
          creator_id: input.organizationId,
          external_id: input.passthrough,
        },
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
    signal: AbortSignal.timeout(30_000),
    method: "POST",
  }).catch(() => {
    throw new VideoProviderError(true);
  });
  if (!response.ok) {
    throw new VideoProviderError(
      response.status === 429 || response.status >= 500,
    );
  }
  const body = (await response.json().catch((error: unknown) => {
    throw new VideoProviderError(!(error instanceof SyntaxError));
  })) as {
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

/** One bounded inventory page. An empty page does not prove a POST was rejected. */
export async function listMuxImportCandidates(cursor?: string): Promise<{
  assets: { id: string; passthrough?: string }[];
  nextCursor: string | null;
}> {
  if (cursor && cursor.length > 2048) throw new Error("Invalid Mux cursor.");
  const url = new URL("https://api.mux.com/video/v1/assets");
  url.searchParams.set("limit", "100");
  if (cursor) url.searchParams.set("cursor", cursor);
  const response = await fetch(url, {
    headers: { Authorization: muxAuthorization() },
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Mux inventory unavailable.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Mux inventory unavailable.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 1_000_000) {
      await reader.cancel();
      throw new Error("Mux inventory page too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (
    !payload ||
    typeof payload !== "object" ||
    !("data" in payload) ||
    !Array.isArray(payload.data) ||
    payload.data.length > 100
  )
    throw new Error("Invalid Mux inventory.");
  const assets = payload.data.map((asset: unknown) => {
    if (
      !asset ||
      typeof asset !== "object" ||
      !("id" in asset) ||
      typeof asset.id !== "string" ||
      !asset.id ||
      asset.id.length > 255
    )
      throw new Error("Invalid Mux asset.");
    const passthrough = "passthrough" in asset ? asset.passthrough : undefined;
    if (
      passthrough != null &&
      (typeof passthrough !== "string" || passthrough.length > 255)
    )
      throw new Error("Invalid Mux reference.");
    return {
      id: asset.id,
      ...(typeof passthrough === "string" ? { passthrough } : {}),
    };
  });
  const nextCursor = "next_cursor" in payload ? payload.next_cursor : null;
  if (
    nextCursor != null &&
    (typeof nextCursor !== "string" || nextCursor.length > 2048 || !nextCursor)
  )
    throw new Error("Invalid Mux cursor.");
  return {
    assets,
    nextCursor: typeof nextCursor === "string" ? nextCursor : null,
  };
}
