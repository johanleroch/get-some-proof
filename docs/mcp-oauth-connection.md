# MCP OAuth connection diagnosis

Observed on 2026-09-12 against production with Codex CLI 0.147.0.
Starting revision: `7346604`. No production configuration or deployment was changed.

## HTTP evidence

| Request                                                              | Observed response                                |
| -------------------------------------------------------------------- | ------------------------------------------------ |
| `GET https://getsomeproof.com/mcp`                                   | `308 Location: https://www.getsomeproof.com/mcp` |
| `GET https://www.getsomeproof.com/mcp`                               | `405`, allows POST                               |
| `POST https://www.getsomeproof.com/mcp` (MCP initialize)             | `503`, body `Not enabled`                        |
| `GET /.well-known/oauth-protected-resource/mcp` on www               | `404`, empty body                                |
| `GET /.well-known/oauth-protected-resource` on www                   | `404`, empty body                                |
| `GET /.well-known/oauth-authorization-server/api/import-auth` on www | `404`, empty body                                |
| `POST /api/import-auth/oauth2/register` on www with `{}`             | `404`, empty body                                |
| `GET /.well-known/oauth-authorization-server` on www                 | `404`, Next.js HTML                              |
| `POST /register` on www                                              | `404`, Next.js HTML                              |

Both supplied login commands were reproduced using disposable `CODEX_HOME`
directories; the user's configured server and credentials were not changed.
The apex URL fails with `OAuth discovery redirect to non-same-origin URL rejected`.
The www URL fails with `Dynamic registration failed: HTTP 404 Not Found` and HTML.

A local HTTP trace with the same 405/404 discovery responses establishes Codex's
fallback: it probes protected-resource metadata at the path-specific and root
locations, probes authorization-server/OpenID metadata, then calls **POST
/register**. This trace is a local reproduction, not a captured production TLS
trace. Production `/register` independently returns the matching HTML 404.

## Root causes

1. Copied commands use the configured `NEXT_PUBLIC_SITE_URL` verbatim. A legacy
   apex value generates a URL that Vercel redirects across origins. Codex refuses
   that discovery redirect. The command builder now maps the exact production
   apex origin to www; custom and localhost origins remain unchanged.
2. The integration is disabled at the web boundary. `src/app/mcp/route.ts`
   returns `503 Not enabled` precisely when `CHATGPT_IMPORT_ENABLED !== "true"`.
   Protected-resource metadata has the same gate and returns 404. Codex cannot
   discover the separate issuer and falls back to `/register`, which is not a
   Next.js route. Adding a `/register` rewrite would hide the deployment problem.
3. The backend metadata and intended registration route also return empty 404s.
   The matching Convex handlers return that response when their own
   `CHATGPT_IMPORT_ENABLED` is not true. This is consistent with the backend
   rollout gate; public HTTP alone does not inspect the production environment
   or prove which backend revision/configuration is deployed.

The production reference file already names the www origin. Its backend,
`brazen-shark-68.convex.site`, independently returns an empty 404 for the issuer
metadata. This supports a backend-side problem rather than a Next.js rewrite;
the checked-in/reference configuration is not proof of the live Vercel values.

`No apps connected yet` is consistent with no authorized grant being saved.
Being Pro or accepting reuse rights does not enable either server's rollout flag.

## Intended route chain

1. `/.well-known/oauth-protected-resource/mcp` advertises resource
   `https://www.getsomeproof.com/mcp` and issuer
   `https://www.getsomeproof.com/api/import-auth`.
2. `/.well-known/oauth-authorization-server/api/import-auth` forwards via the
   real `convexBetterAuthNextJs` handler to the same path on
   `NEXT_PUBLIC_CONVEX_SITE_URL`. `convex/http.ts` explicitly registers it.
3. Better Auth metadata advertises `/api/import-auth/oauth2/authorize`,
   `/api/import-auth/oauth2/token` and `/api/import-auth/oauth2/register` on the
   configured application origin. Next.js's `/api/import-auth/[...all]` forwards
   GET/POST without changing paths; Convex registers that prefix for both methods.
4. DCR permits public clients (`token_endpoint_auth_method: none`), requires PKCE,
   and allows authorization-code and refresh-token grants. Both
   `testimonials:import:assistant` and `offline_access` are configured scopes.

There is no Next.js rewrite for these routes. The public apex redirect is observed
at the hosting boundary. The existing authorization GET wrapper restores browser
302 navigation from Better Auth's JSON envelope; it does not handle registration.

Current documentation was retrieved with Context7:
[Codex OAuth registration](https://github.com/openai/codex/blob/main/codex-rs/rmcp-client/src/oauth_client_registration.rs)
and [Better Auth OAuth provider](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/oauth-provider.mdx).
The installed Next.js 16.3.3 route-handler guide and Convex Better Auth 0.12.5
proxy source were also inspected. The observed CLI trace takes precedence over
newer documentation when describing this installed CLI's behavior.

## Configuration repair, not applied to production

| Variable                      | Runtime/provider                           | Required value and purpose                                  |
| ----------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| `CHATGPT_IMPORT_ENABLED`      | Next.js server / Vercel target environment | `true` to expose MCP and resource discovery                 |
| `CHATGPT_IMPORT_ENABLED`      | Matching Convex deployment                 | `true` to expose issuer metadata, DCR and import operations |
| `NEXT_PUBLIC_SITE_URL`        | Next.js / Vercel, public build-time value  | `https://www.getsomeproof.com` in production                |
| `SITE_URL`                    | Matching Convex deployment                 | Same canonical origin for issuer, audience and consent URLs |
| `NEXT_PUBLIC_CONVEX_URL`      | Next.js / Vercel                           | Matching deployment's `.convex.cloud` URL                   |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Next.js / Vercel                           | Matching deployment's `.convex.site` HTTP origin            |

For local development use the same localhost origin and port for both site URL
variables, and the development backend in both Convex URL variables. The example
files now document the flag in both runtimes and default it to false. Editing
examples does not configure either deployed runtime. A separately authorized
production rollout must apply the values and rebuild the frontend; this task does
not do so.

## Verification and commands

Run the unattended, non-registering HTTP check:

```sh
node scripts/check-mcp-oauth.mjs https://www.getsomeproof.com/mcp
```

It refuses redirects and verifies the resource, issuer, announced endpoints,
scopes, public client support and PKCE. It fails on the current public deployment.
Use `--register` only on an explicitly chosen test environment to also create one
public OAuth client at the advertised endpoint; it omits the client identifier
and never requests user credentials or exchanges a token.

After the server configuration is repaired, replace the existing entry and log in:

```sh
codex mcp add get-some-proof --url https://www.getsomeproof.com/mcp
codex mcp login get-some-proof --scopes testimonials:import:assistant,offline_access
```

The corrected URL alone does not repair the disabled integration.

Local regression coverage exercises the command builder and the actual Next.js
metadata/auth proxy handlers through Convex's in-memory HTTP router, including
public DCR 201. Existing OAuth tests exercise token exchange, refresh and
revocation with synthetic users. These are automated tests, not real Codex OAuth.

- [x] Both reported CLI errors reproduced without changing the user's config.
- [x] Canonical command regression failed before the fix and passes after it.
- [x] Enabled discovery-to-registration chain passes against real handlers with an in-memory backend.
- [ ] Production rollout/configuration repair (excluded from this task).
- [ ] Real Codex browser consent, callback and token exchange succeed.
- [ ] Authenticated Codex tool call and connected-app state verified.

Do not call the production connection resolved until the last two checks pass.
