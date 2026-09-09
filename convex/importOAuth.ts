import type { GenericCtx } from "@convex-dev/better-auth";
import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { betterAuth } from "better-auth/minimal";
import type { DataModel } from "./_generated/dataModel";
import { components, internal } from "./_generated/api";
import { env, httpAction, internalMutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { BetterAuthOptions } from "better-auth";
import { verifyImportAccessToken } from "./domain/importAccessToken";
import { authComponent, createAuth } from "./auth";
import {
  createImportOAuthOptions,
  importOAuthBasePath,
  importOAuthScope,
} from "./importOAuthOptions";

export async function createImportOAuth(ctx: GenericCtx<DataModel>) {
  const website = await createAuth(ctx).$context;
  const database = authComponent.adapter(ctx);
  return betterAuth(
    createImportOAuthOptions({
      siteUrl: env.SITE_URL,
      database: (options: BetterAuthOptions) => {
        const adapter = database(options);
        return {
          ...adapter,
          incrementOne: async <T>(
            args: Parameters<typeof adapter.incrementOne>[0],
          ): Promise<T | null> => {
            if (args.model !== "oauthRefreshToken")
              return adapter.incrementOne<T>(args);
            const id = args.where.find((entry) => entry.field === "id");
            const revoked = args.where.find(
              (entry) => entry.field === "revoked",
            );
            if (
              args.where.length !== 2 ||
              args.where.some((entry) => entry.connector === "OR") ||
              typeof id?.value !== "string" ||
              (id.operator && id.operator !== "eq") ||
              revoked?.value !== null ||
              (revoked.operator && revoked.operator !== "eq") ||
              Object.keys(args.increment).length ||
              Object.keys(args.set ?? {}).length !== 1 ||
              !(args.set?.revoked instanceof Date)
            )
              throw new Error("Unsupported refresh-token update.");
            if (!("runMutation" in ctx))
              throw new Error(
                "Refresh-token rotation requires a writable context.",
              );
            const consumed = await ctx.runMutation(
              components.betterAuth.importRefreshTokens.consume,
              {
                id: id.value,
              },
            );
            return consumed
              ? adapter.findOne<T>({
                  model: args.model,
                  where: [{ field: "id", value: id.value }],
                })
              : null;
          },
        };
      },
      // Reuse the configured secret to recognize the existing website session
      // cookie. OAuth JWTs still have their own issuer and resource audience.
      secret: website.secret,
    }),
  );
}

const allowedPaths: Record<string, string> = {
  "/oauth2/authorize": "GET",
  "/oauth2/consent": "POST",
  "/oauth2/token": "POST",
  "/oauth2/revoke": "POST",
  "/oauth2/public-client": "GET",
  "/jwks": "GET",
};

export const importOAuthHttp = httpAction(async (ctx, request) => {
  if (env.CHATGPT_IMPORT_ENABLED !== "true")
    return new Response(null, { status: 404 });
  const path = new URL(request.url).pathname.slice(importOAuthBasePath.length);
  if (allowedPaths[path] !== request.method)
    return new Response(null, { status: 404 });
  const auth = await createImportOAuth(ctx);
  const response = await auth.handler(request);
  response.headers.set("Cache-Control", "no-store");
  return response;
});

export const importOAuthMetadata = httpAction(async (ctx, request) => {
  if (env.CHATGPT_IMPORT_ENABLED !== "true")
    return new Response(null, { status: 404 });
  const auth = await createImportOAuth(ctx);
  return oauthProviderAuthServerMetadata(auth)(request);
});

/** Operator-only provisioning. Public registration endpoints stay closed. */
export const registerClient = internalMutation({
  args: { name: v.string(), redirectUri: v.string() },
  returns: v.object({ clientId: v.string() }),
  handler: async (ctx, args) => {
    if (env.CHATGPT_IMPORT_ENABLED !== "true")
      throw new ConvexError("Import integration disabled.");
    if (
      !args.name.trim() ||
      args.name.length > 120 ||
      args.redirectUri.length > 2048
    )
      throw new ConvexError("Invalid client details.");
    const redirect = new URL(args.redirectUri);
    if (
      redirect.protocol !== "https:" ||
      redirect.username ||
      redirect.password ||
      redirect.hash
    )
      throw new ConvexError("Use the client's exact HTTPS callback URL.");
    // The provider's management API requires an interactive user session even
    // for its server-only endpoint. Provision public metadata through the
    // component instead; no user session or client secret is fabricated.
    const clientId = crypto.randomUUID();
    await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "importOAuthClient",
        data: {
          clientId,
          name: args.name,
          redirectUris: [args.redirectUri],
          scopes: [importOAuthScope, "offline_access"],
          tokenEndpointAuthMethod: "none",
          grantTypes: ["authorization_code", "refresh_token"],
          responseTypes: ["code"],
          public: true,
          requirePKCE: true,
          skipConsent: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
    });
    return { clientId };
  },
});

/** Narrow resource endpoint: a scoped OAuth token is never a website JWT. */
export const importDestinationsHttp = httpAction(async (ctx, request) => {
  if (env.CHATGPT_IMPORT_ENABLED !== "true")
    return new Response(null, { status: 404 });
  const origin = new URL(env.SITE_URL).origin;
  const headers = { "Cache-Control": "no-store" };
  const unauthorized = () =>
    new Response(null, {
      status: 401,
      headers: {
        ...headers,
        "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp", scope="${importOAuthScope}", error="invalid_token", error_description="Connect your account again"`,
      },
    });
  const authorization = request.headers.get("authorization");
  if (!authorization || authorization.length > 8192) return unauthorized();
  const auth = await createImportOAuth(ctx);
  const grant = await verifyImportAccessToken(
    authorization,
    auth.api.verifyJWT,
  );
  if (!grant) return unauthorized();
  const cursor = new URL(request.url).searchParams.get("cursor");
  if (cursor && cursor.length > 2048)
    return new Response(null, { status: 400, headers });
  try {
    const result = await ctx.runQuery(
      internal.importOAuthCommands.destinations,
      {
        grant,
        paginationOpts: { cursor, numItems: 20 },
      },
    );
    return Response.json(result, { headers });
  } catch (error) {
    if (
      error instanceof ConvexError &&
      typeof error.data === "object" &&
      error.data?.code === "IMPORT_AUTH_REQUIRED"
    )
      return unauthorized();
    return new Response(null, { status: 400, headers });
  }
});

function importCommandHttp(
  command: "save" | "status" | "retry" | "retry-photo" | "eligibility",
) {
  return httpAction(async (ctx, request) => {
    if (env.CHATGPT_IMPORT_ENABLED !== "true")
      return new Response(null, { status: 404 });
    const headers = { "Cache-Control": "no-store" };
    const authorization = request.headers.get("authorization");
    if (!authorization || authorization.length > 8192)
      return new Response(null, { status: 401, headers });
    const auth = await createImportOAuth(ctx);
    const grant = await verifyImportAccessToken(
      authorization,
      auth.api.verifyJWT,
    );
    if (!grant) return new Response(null, { status: 401, headers });
    const reader = request.body?.getReader();
    if (!reader) return new Response(null, { status: 400, headers });
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 1024) {
        await reader.cancel();
        return new Response(null, { status: 413, headers });
      }
      chunks.push(value);
    }
    try {
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const args: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (!args || typeof args !== "object")
        return new Response(null, { status: 400, headers });
      let result: unknown;
      if (command === "save" || command === "eligibility") {
        if (
          !("token" in args) ||
          typeof args.token !== "string" ||
          !("organizationId" in args) ||
          typeof args.organizationId !== "string"
        )
          return new Response(null, { status: 400, headers });
        result = await ctx.runMutation(
          command === "save"
            ? internal.importOAuthCommands.save
            : internal.importOAuthCommands.eligibility,
          {
            grant,
            token: args.token,
            organizationId:
              args.organizationId as import("./_generated/dataModel").Id<"organizations">,
          },
        );
      } else {
        if (!("jobId" in args) || typeof args.jobId !== "string")
          return new Response(null, { status: 400, headers });
        const jobId =
          args.jobId as import("./_generated/dataModel").Id<"testimonialImportJobs">;
        if (command === "retry" || command === "retry-photo") {
          if (!("itemId" in args) || typeof args.itemId !== "string")
            return new Response(null, { status: 400, headers });
          await ctx.runMutation(
            command === "retry-photo"
              ? internal.importOAuthCommands.retryPhoto
              : internal.importOAuthCommands.retryVideo,
            {
              grant,
              jobId,
              itemId:
                args.itemId as import("./_generated/dataModel").Id<"testimonialImportItems">,
            },
          );
        }
        result = await ctx.runQuery(internal.importOAuthCommands.status, {
          grant,
          jobId,
        });
      }
      return Response.json(result, { headers });
    } catch (error) {
      if (
        error instanceof ConvexError &&
        typeof error.data === "object" &&
        error.data?.code === "IMPORT_AUTH_REQUIRED"
      )
        return new Response(null, { status: 401, headers });
      if (
        error instanceof ConvexError &&
        typeof error.data === "object" &&
        error.data &&
        (error.data.code === "VIDEO_CAPACITY_REACHED" ||
          error.data.code === "INVALID_RETRY" ||
          error.data.code === "IMPORT_UNAVAILABLE")
      )
        return Response.json(
          { code: error.data.code },
          { status: 409, headers },
        );
      return new Response(null, { status: 400, headers });
    }
  });
}

export const importSaveHttp = importCommandHttp("save");
export const importStatusHttp = importCommandHttp("status");
export const importPhotoRetryHttp = importCommandHttp("retry-photo");
export const importRetryHttp = importCommandHttp("retry");
export const importEligibilityHttp = importCommandHttp("eligibility");
