import { assistantUploadCapabilitySchema } from "@/lib/chatgpt/import-wire";
import { assistantMigrationStatusSchema } from "@/lib/chatgpt/import-wire";
import {
  AssistantAuthenticationRequired,
  AssistantOperationError,
  assistantOperationCode,
} from "@/lib/chatgpt/assistant-tools";
import { ConvexHttpClient } from "convex/browser";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { api } from "@convex/_generated/api";
import {
  createImportServer,
  ImportAuthenticationRequired,
  ImportOperationError,
} from "@/lib/chatgpt/import-server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  importProjectsSchema,
  savedImportSchema,
  importStatusSchema,
  importOperationErrorSchema,
  importEligibilitySchema,
} from "@/lib/chatgpt/import-wire";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.CHATGPT_IMPORT_ENABLED !== "true")
    return new Response("Not enabled", { status: 503 });
  const backend = process.env.NEXT_PUBLIC_CONVEX_URL;
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!backend || !origin)
    return new Response("Not configured", { status: 503 });
  const parsedOrigin = URL.parse(origin);
  if (!parsedOrigin || !["http:", "https:"].includes(parsedOrigin.protocol))
    return new Response("Not configured", { status: 503 });
  const reader = request.body?.getReader();
  if (!reader) return new Response("Missing body", { status: 400 });
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 1_004_096) {
      await reader.cancel();
      return new Response("Request too large", { status: 413 });
    }
    chunks.push(value);
  }
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return new Response(
      length > 16_384 ? "Request too large" : "Invalid JSON",
      { status: length > 16_384 ? 413 : 400 },
    );
  }
  // Only the app-only cropped-image command needs more than the normal budget.
  const photoCall =
    parsedBody &&
    typeof parsedBody === "object" &&
    "method" in parsedBody &&
    parsedBody.method === "tools/call" &&
    "params" in parsedBody &&
    parsedBody.params &&
    typeof parsedBody.params === "object" &&
    "name" in parsedBody.params &&
    parsedBody.params.name === "set_testimonial_photo";
  const assistantTextCall =
    parsedBody &&
    typeof parsedBody === "object" &&
    "method" in parsedBody &&
    parsedBody.method === "tools/call" &&
    "params" in parsedBody &&
    parsedBody.params &&
    typeof parsedBody.params === "object" &&
    "name" in parsedBody.params &&
    ["import_testimonial_text", "import_testimonials"].includes(
      String(parsedBody.params.name),
    );
  if (length > (assistantTextCall ? 504_096 : 16_384) && !photoCall)
    return new Response("Request too large", { status: 413 });
  const client = new ConvexHttpClient(backend);
  async function assistantRequest(
    command: string,
    args: Record<string, unknown>,
  ) {
    const authorization = request.headers.get("authorization");
    if (!authorization || authorization.length > 8192)
      throw new AssistantAuthenticationRequired();
    const backendSite = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    if (!backendSite) throw new Error("Import backend unavailable.");
    const response = await fetch(
      new URL(`/api/import-mcp/assistant-${command}`, backendSite),
      {
        method: "POST",
        headers: { authorization, "content-type": "application/json" },
        body: JSON.stringify(args),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (response.status === 401) throw new AssistantAuthenticationRequired();
    if (response.status === 409) {
      const failure: unknown = await response.json();
      if (failure && typeof failure === "object" && "code" in failure) {
        const parsed = assistantOperationCode.safeParse(failure.code);
        if (parsed.success) throw new AssistantOperationError(parsed.data);
      }
    }
    if (!response.ok) throw new Error("Import unavailable.");
    const body: unknown = await response.json();
    if (command === "projects") return importProjectsSchema.parse(body);
    if (command === "upload")
      return assistantUploadCapabilitySchema.parse(body);
    if (command === "migration")
      return assistantMigrationStatusSchema.parse(body);
    const saved = (
      command === "status" ||
      command === "retry-portrait" ||
      command === "resume-videos"
        ? importStatusSchema
        : savedImportSchema
    )
      .omit({ inboxUrl: true })
      .parse(body);
    return {
      ...saved,
      inboxUrl: new URL(
        `/org/${encodeURIComponent(saved.organizationSlug)}/inbox?import=${encodeURIComponent(saved.jobId)}`,
        origin,
      ).href,
    };
  }
  async function importProgress(
    command: "status" | "retry" | "retry-photo",
    args: { jobId: string; itemId?: string },
  ) {
    const authorization = request.headers.get("authorization");
    if (!authorization || authorization.length > 8192)
      throw new ImportAuthenticationRequired();
    const backendSite = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    if (!backendSite) throw new Error("Import backend unavailable.");
    const response = await fetch(
      new URL(`/api/import-mcp/${command}`, backendSite),
      {
        method: "POST",
        headers: { authorization, "content-type": "application/json" },
        body: JSON.stringify(args),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (response.status === 401) throw new ImportAuthenticationRequired();
    if (response.status === 409) {
      const body: unknown = await response.json();
      if (body && typeof body === "object" && "code" in body) {
        const code = importOperationErrorSchema.safeParse(body.code);
        if (code.success) throw new ImportOperationError(code.data);
      }
    }
    if (!response.ok) throw new Error("Import unavailable.");
    const status = importStatusSchema
      .omit({ inboxUrl: true })
      .parse(await response.json());
    return {
      ...status,
      inboxUrl: new URL(
        `/org/${encodeURIComponent(status.organizationSlug)}/inbox?import=${encodeURIComponent(status.jobId)}`,
        origin,
      ).href,
    };
  }
  const server = createImportServer(
    {
      preview: (url) =>
        client.action(api.testimonialImportSource.previewAnonymous, {
          url,
          channel: "chatgpt",
        }),
      read: (args) => client.query(api.anonymousWallImports.read, args),
      correctIdentity: (args) =>
        client.mutation(api.anonymousWallImports.correctIdentity, args),
      photo: ({ token, position, imageBase64 }) =>
        imageBase64 === null
          ? client.mutation(api.importAvatarUpload.remove, {
              target: { token, position },
            })
          : client.action(api.importAvatarUpload.upload, {
              target: { token, position },
              bytes: Uint8Array.from(Buffer.from(imageBase64, "base64")).buffer,
            }),
      select: (args) => client.mutation(api.anonymousWallImports.select, args),
    },
    () =>
      readFile(
        path.join(process.cwd(), "public/chatgpt/import-widget.html"),
        "utf8",
      ),
    {
      challenge: `Bearer resource_metadata="${parsedOrigin.origin}/.well-known/oauth-protected-resource/mcp", scope="testimonials:import", error="insufficient_scope", error_description="Connect your account to choose a Project"`,
      status: (args) => importProgress("status", args),
      retryPhoto: (args) => importProgress("retry-photo", args),
      retryVideo: (args) => importProgress("retry", args),
      eligibility: async (args) => {
        const authorization = request.headers.get("authorization");
        if (!authorization || authorization.length > 8192)
          throw new ImportAuthenticationRequired();
        const backendSite = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
        if (!backendSite) throw new Error("Import backend unavailable.");
        const response = await fetch(
          new URL("/api/import-mcp/eligibility", backendSite),
          {
            method: "POST",
            headers: { authorization, "content-type": "application/json" },
            body: JSON.stringify(args),
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(15000),
          },
        );
        if (response.status === 401) throw new ImportAuthenticationRequired();
        if (!response.ok) throw new Error("Selection unavailable.");
        return importEligibilitySchema.parse(await response.json());
      },
      destinations: async (cursor) => {
        const authorization = request.headers.get("authorization");
        if (!authorization || authorization.length > 8192)
          throw new ImportAuthenticationRequired();
        const backendSite = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
        if (!backendSite) throw new Error("Import backend unavailable.");
        const url = new URL("/api/import-mcp/destinations", backendSite);
        if (cursor) url.searchParams.set("cursor", cursor);
        const response = await fetch(url, {
          headers: { authorization },
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(15_000),
        });
        if (response.status === 401) throw new ImportAuthenticationRequired();
        if (!response.ok) throw new Error("Import backend unavailable.");
        return importProjectsSchema.parse(await response.json());
      },
      save: async (args) => {
        const authorization = request.headers.get("authorization");
        if (!authorization || authorization.length > 8192)
          throw new ImportAuthenticationRequired();
        const backendSite = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
        if (!backendSite) throw new Error("Import backend unavailable.");
        const response = await fetch(
          new URL("/api/import-mcp/save", backendSite),
          {
            method: "POST",
            headers: { authorization, "content-type": "application/json" },
            body: JSON.stringify(args),
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(30_000),
          },
        );
        if (response.status === 401) throw new ImportAuthenticationRequired();
        if (response.status === 409) {
          const body: unknown = await response.json();
          if (body && typeof body === "object" && "code" in body) {
            const code = importOperationErrorSchema.safeParse(body.code);
            if (code.success) throw new ImportOperationError(code.data);
          }
        }
        if (!response.ok) throw new Error("Import could not be confirmed.");
        const saved = savedImportSchema
          .omit({ inboxUrl: true })
          .parse(await response.json());
        return {
          ...saved,
          inboxUrl: new URL(
            `/org/${encodeURIComponent(saved.organizationSlug)}/inbox?import=${encodeURIComponent(saved.jobId)}`,
            origin,
          ).href,
        };
      },
    },
    origin,
    backend,
    {
      challenge: `Bearer resource_metadata="${parsedOrigin.origin}/.well-known/oauth-protected-resource/mcp", scope="testimonials:import"`,
      destinations: (cursor) => assistantRequest("projects", { cursor }),
      status: (jobId) => assistantRequest("status", { jobId }),
      retryPortrait: (args) => assistantRequest("retry-portrait", args),
      resumeVideos: (args) => assistantRequest("resume-videos", args),
      submitText: (args) => assistantRequest("text", args),
      submitBatch: (args) => assistantRequest("batch", args),
      migrationStatus: (args) => assistantRequest("migration", args),
      upload: (args) => assistantRequest("upload", args),
    },
  );
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    enableDnsRebindingProtection: true,
    allowedHosts: [parsedOrigin.host],
    allowedOrigins: [parsedOrigin.origin, "https://chatgpt.com"],
  });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(request, { parsedBody });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } finally {
    await server.close();
  }
}

export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
