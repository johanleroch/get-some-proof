import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { z } from "zod";
import { isImportOAuthRedirect } from "../src/lib/chatgpt/oauth-redirect";
import { oauthProvider } from "@better-auth/oauth-provider";
import type { BetterAuthOptions } from "better-auth";
import { jwt } from "better-auth/plugins";

export const importOAuthBasePath = "/api/import-auth";
export function parseImportGrantGeneration(
  referenceId: string | null | undefined,
): number | undefined {
  if (!referenceId || !/^import-v1:\d+$/.test(referenceId)) return undefined;
  const value = Number(referenceId.slice("import-v1:".length));
  return Number.isSafeInteger(value) ? value : undefined;
}

export const importOAuthScope = "testimonials:import";
export const assistantOAuthScope = "testimonials:import:assistant";

const registration = z.object({
  client_name: z.string().min(1).max(120).optional(),
  redirect_uris: z
    .array(z.string().refine(isImportOAuthRedirect))
    .min(1)
    .max(5),
  token_endpoint_auth_method: z.literal("none").optional(),
  grant_types: z
    .array(z.enum(["authorization_code", "refresh_token"]))
    .min(1)
    .max(2)
    .optional(),
  response_types: z.array(z.literal("code")).length(1).optional(),
  scope: z.string().max(200).optional(),
  require_pkce: z.literal(true).optional(),
  type: z.enum(["native", "user-agent-based"]).optional(),
});

/** Separate issuer: an import grant must never become a website session JWT. */
export function createImportOAuthOptions({
  siteUrl,
  database,
  secret,
  canConnect,
  canExchangeCode,
  getGrantGeneration,
}: {
  getGrantGeneration?: (actorId: string, clientId: string) => Promise<number>;
  canExchangeCode?: (
    actorId: string,
    clientId: string,
    issuedAt: number,
    generation?: number,
    scope?: string,
  ) => Promise<boolean>;
  siteUrl: string;
  database: BetterAuthOptions["database"];
  secret: string;
  canConnect?: (
    actorId: string,
    requireActivation: boolean,
  ) => Promise<boolean>;
}) {
  const origin = new URL(siteUrl).origin;
  return {
    appName: "Get Some Proof",
    baseURL: origin,
    basePath: importOAuthBasePath,
    database,
    secret,
    trustedOrigins: [origin],
    // Only the OAuth instance disables this path. The site's /api/auth/token
    // remains owned by the Convex plugin and keeps its existing audience.
    disabledPaths: ["/token"],
    databaseHooks: {
      verification: {
        create: {
          before: async (verification) => {
            let value;
            try {
              value = JSON.parse(verification.value);
            } catch {
              return;
            }
            if (value?.type !== "authorization_code") return;
            const generation =
              getGrantGeneration &&
              typeof value.userId === "string" &&
              typeof value.query?.client_id === "string"
                ? await getGrantGeneration(value.userId, value.query.client_id)
                : 0;
            return {
              data: {
                ...verification,
                value: JSON.stringify({
                  ...value,
                  referenceId: `import-v1:${generation}`,
                  importIssuedAt: Date.now(),
                }),
              },
            };
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const requestedScope =
          ctx.path === "/oauth2/authorize"
            ? ctx.query?.scope
            : new URLSearchParams(
                typeof ctx.body?.oauth_query === "string"
                  ? ctx.body.oauth_query
                  : "",
              ).get("scope");
        const assistantRequest =
          typeof requestedScope === "string" &&
          requestedScope.split(" ").includes(assistantOAuthScope);
        if (
          canConnect &&
          assistantRequest &&
          (ctx.path === "/oauth2/authorize" ||
            (ctx.path === "/oauth2/consent" && ctx.body?.accept !== false))
        ) {
          const session = await getSessionFromCtx(ctx);
          if (
            session &&
            (!session.user.emailVerified ||
              !(await canConnect(
                session.user.id,
                ctx.path === "/oauth2/consent",
              )))
          ) {
            throw new APIError("FORBIDDEN", {
              error: "access_denied",
              error_description:
                "A verified Pro account and reuse rights confirmation are required to connect.",
            });
          }
        }
        if (ctx.path !== "/oauth2/register") return;
        const parsed = registration.safeParse(ctx.body);
        if (!parsed.success)
          throw new APIError("BAD_REQUEST", {
            error: "invalid_client_metadata",
            error_description:
              "Use a public PKCE client with an HTTPS or loopback callback.",
          });
        // Claude Code registers the resource scopes, then adds offline_access
        // at authorization. A refresh-capable public client may request it;
        // issuance still requires the user to consent to that scope.
        if (
          parsed.data.scope &&
          parsed.data.grant_types?.includes("refresh_token")
        ) {
          parsed.data.scope = Array.from(
            new Set([
              ...parsed.data.scope.split(" ").filter(Boolean),
              "offline_access",
            ]),
          ).join(" ");
        }
        // Only public descriptive metadata is accepted. Drop management flags,
        // remote key URLs and any request to skip consent.
        for (const key of Object.keys(ctx.body)) delete ctx.body[key];
        Object.assign(ctx.body, parsed.data, {
          token_endpoint_auth_method: "none",
          require_pkce: true,
        });
      }),
    },
    plugins: [
      jwt({
        disableSettingJwtHeader: true,
        jwt: {
          issuer: `${origin}${importOAuthBasePath}`,
          audience: `${origin}/mcp`,
        },
        jwks: { keyPairConfig: { alg: "RS256" } },
      }),
      oauthProvider({
        schema: {
          oauthClient: { modelName: "importOAuthClient" },
          oauthConsent: { modelName: "importOAuthConsent" },
          oauthAccessToken: { modelName: "importOAuthAccessToken" },
          oauthRefreshToken: { modelName: "importOAuthRefreshToken" },
        },
        customAccessTokenClaims: async ({ referenceId }) => ({
          import_grant_generation: parseImportGrantGeneration(referenceId),
        }),
        customTokenResponseFields: async ({ grantType, verificationValue }) => {
          if (grantType !== "authorization_code" || !canExchangeCode) return {};
          const value = verificationValue as
            | {
                userId?: unknown;
                query?: { client_id?: unknown; scope?: unknown };
                importIssuedAt?: unknown;
                referenceId?: string;
              }
            | undefined;
          if (
            typeof value?.userId !== "string" ||
            typeof value.query?.client_id !== "string" ||
            typeof value.importIssuedAt !== "number" ||
            !(await canExchangeCode(
              value.userId,
              value.query.client_id,
              value.importIssuedAt,
              parseImportGrantGeneration(value.referenceId),
              typeof value.query.scope === "string" &&
                value.query.scope.split(" ").includes(assistantOAuthScope)
                ? assistantOAuthScope
                : importOAuthScope,
            ))
          ) {
            throw new APIError("UNAUTHORIZED", {
              error: "invalid_grant",
              error_description:
                "This authorization has been revoked. Connect again.",
            });
          }
          // Access and refresh tokens retain this authorization generation.
          // A later revocation invalidates them even if issuance is concurrent.
          return {};
        },
        loginPage: `${origin}/import/connect`,
        consentPage: `${origin}/import/authorize`,
        scopes: [importOAuthScope, assistantOAuthScope, "offline_access"],
        validAudiences: [`${origin}/mcp`],
        grantTypes: ["authorization_code", "refresh_token"],
        accessTokenExpiresIn: 15 * 60,
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
        clientRegistrationAllowedScopes: [
          importOAuthScope,
          assistantOAuthScope,
          "offline_access",
        ],
        clientRegistrationDefaultScopes: [
          importOAuthScope,
          assistantOAuthScope,
          "offline_access",
        ],
      }),
    ],
  } satisfies BetterAuthOptions;
}
