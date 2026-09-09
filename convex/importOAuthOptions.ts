import { oauthProvider } from "@better-auth/oauth-provider";
import type { BetterAuthOptions } from "better-auth";
import { jwt } from "better-auth/plugins";

export const importOAuthBasePath = "/api/import-auth";
export const importOAuthScope = "testimonials:import";

/** Separate issuer: an import grant must never become a website session JWT. */
export function createImportOAuthOptions({
  siteUrl,
  database,
  secret,
}: {
  siteUrl: string;
  database: BetterAuthOptions["database"];
  secret: string;
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
        loginPage: `${origin}/import/connect`,
        consentPage: `${origin}/import/authorize`,
        scopes: [importOAuthScope, "offline_access"],
        validAudiences: [`${origin}/mcp`],
        grantTypes: ["authorization_code", "refresh_token"],
        accessTokenExpiresIn: 15 * 60,
        allowDynamicClientRegistration: false,
        allowUnauthenticatedClientRegistration: false,
      }),
    ],
  } satisfies BetterAuthOptions;
}
