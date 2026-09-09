# ChatGPT import adapter

## Current implementation

`POST /mcp` uses the official MCP TypeScript SDK 1.29.0 and stateless Streamable
HTTP with JSON responses. `CHATGPT_IMPORT_ENABLED=true` enables the route;
it is disabled by default. The local worktree enables it for verification.
The route limits bodies to 16 KiB, checks configured host/browser origins and
returns no-store responses. GET/SSE subscriptions are not offered.

The current tools are:

- `preview_testimonial_wall`: creates the shared anonymous snapshot with ChatGPT acquisition attribution.
- `read_testimonial_preview` and `select_testimonial_preview`: read/filter/page and persist selection.
- `correct_testimonial_identity`: preserves separate identity corrections.
- `continue_testimonial_import`: prepares an explicit website continuation with the same preview.
- `list_import_projects` and `save_testimonial_import`: require the separate OAuth import grant and current ownership/consent checks.

Only the initial preview tool is model-visible. The other controls are app-only.
The temporary preview capability stays in tool result metadata and is not an
Account credential. For an explicit website continuation only, it travels in a
fragment to an isolated document which removes it before loading the app. It is
not sent in HTTP request URLs or referrers. No account session, OAuth token or
administrator credential is handed to the browser this way. Original source
content remains data, never instructions; backend errors are sanitized.

## Verified

An actual MCP client initialized against local `/mcp`, listed the three tools,
retrieved a real Testimonial.to wall containing 9 items and saved a selection.
The capability was absent from model-visible results. HTTP probes returned 403
for a foreign browser origin, 413 for an oversized body, 400 for invalid JSON
and 405 for GET. SDK contract tests cover metadata, snapshot reuse, invalid
selection and sanitized failures.

Evidence: `.scratch/url-import-live/mcp-evidence.json` (local, ignored).

## MCP Apps component

The server now registers `ui://get-some-proof/import-v1.html` and attaches it to
the preview tool. `pnpm build:import-widget` bundles the official MCP Apps bridge,
React, the shared `TestimonialImportView`, shared primitives, DESIGN.md CSS and
self-hosted fonts into one HTML resource. Development and production prebuild
scripts regenerate it; the generated HTML is ignored by Git. When reusing a
running server for browser tests, rebuild the widget after source changes.

The component supports URL entry, source preview, selection, format filtering,
pagination and host theme changes. A local MCP Apps host simulator tests those
interactions at desktop and actual mobile viewport widths. The MCP resource
was read using a real HTTP SDK client and its bytes matched the built widget.
These checks do not establish ChatGPT-host rendering or CSP approval.

Account saving supports an explicit Project choice and Pending result through
scoped OAuth tools. Website continuation retains the same preview for signup or
Project creation. Actual ChatGPT host/CSP and listing verification remain open.

## Remaining before delivery

### OAuth implementation constraints verified locally

The worktree pins `better-auth` and `@better-auth/oauth-provider` to 1.6.30,
with `@convex-dev/better-auth` 0.12.5. Account linking is configured and verified
against the isolated local deployment. Its installed `OAuthOptions` declares
`validAudiences`, not the `resources` option from newer provider documentation.
Use the installed version's schema and endpoint contracts during implementation.

Site authentication and MCP authorization must remain separate. The existing
Convex principal resolver obtains a Better Auth session from the JWT's
`sessionId`; accepting an MCP access token as a site session would expose
ordinary account functions without enforcing the import grant's scopes.
Private MCP calls need a bounded, verified dispatch into import operations,
including current owner membership and quota checks. Do not add the MCP audience
to the application's general Convex authentication configuration to bypass this.

The Convex auth plugin already provides the site's JWT endpoint. The generic
OAuth provider setup's instruction to disable `/token` must not be copied before
checking that interaction. Additional provider tables also require a compatible
Better Auth adapter schema; preserve the existing component's stored users and
sessions when introducing that schema.

Installed source references: `@better-auth/oauth-provider/dist/oauth-D74mBkw6.d.mts`
(`OAuthOptions`), `@convex-dev/better-auth/src/client/create-client.ts`
(`safeGetAuthUser`), and the application's `convex/security/principal.ts`.

### Delivery work

`convex/importOAuthOptions.ts` now defines a separate authorization instance at
`/api/import-auth`, with its own issuer, RS256 signing, 15-minute access tokens,
`testimonials:import` and optional `offline_access` scopes. Only authorization
code and refresh grants are enabled. Dynamic registration is disabled; the
eventual ChatGPT client must be registered with its verified exact callback.
Only this instance disables `/token`; the website's `/api/auth/token` is untouched.

An isolated Better Auth memory-adapter integration exercises actual library
handlers for signup (fixture only), public-client registration, authorization,
signed consent resumption, code exchange and JWKS. It verifies the RSA signature,
resource/issuer/scope/expiry, absence of the site's `sessionId` claim, one-use
codes, and rejection of missing/plain PKCE, wrong verifier, wrong resource and
wrong redirect. This is protocol proof for the configuration, not a connected
Convex account or ChatGPT test. In 1.6.30, consent takes `oauth_query`; do not use
the newer documentation's `code` body without changing the pinned version.

The local Better Auth component now preserves the package's complete legacy
schema and adds `importOAuthClient`, `importOAuthConsent`,
`importOAuthAccessToken` and `importOAuthRefreshToken`. The provider maps its
models to these names, so its array-valued scopes never replace legacy string
scopes. `pnpm generate:import-auth-schema` regenerates both schema snapshots
using the pinned package and its adapter generator. Keep these generated files
and the component's generated API with the change.

The component keeps its `betterAuth` mount name. Two pre-existing local browser
sessions were read after the switch, exchanged for the site's Convex JWT and
resolved to the same user IDs. Evidence:
`.scratch/url-import-live/auth-component-migration-evidence.json`.
The complete suite passed 751 tests across 132 files after registering the
local component in the shared test helper; an additional adapter regression
passes for unique client IDs and separate legacy/import consent storage.

The separate HTTP instance and Next proxy are mounted. The backend flag
`CHATGPT_IMPORT_ENABLED=true` enables only authorize, consent, token, revoke,
public-client information and JWKS. It defaults off. Issuer discovery is at
`/.well-known/oauth-authorization-server/api/import-auth`; it advertises S256
and the authorization response issuer parameter. Public registration and the
generic website-session `/token` route are not exposed by this instance.

Operator provisioning uses the internal `importOAuth:registerClient` mutation
with a name and exact HTTPS callback. It creates public-client metadata with
PKCE required and consent enabled, without a fabricated user session or secret.
The provider's own server-only client-management endpoint still requires an
interactive session in 1.6.30, so it cannot serve this operator workflow.

Live local protocol proof now covers the existing website cookie, consent,
issuer response, signature verification through JWKS, the resource-bound
15-minute JWT, code replay rejection, refresh rotation and rejection after
refresh-token revocation. Evidence:
`.scratch/url-import-live/oauth-protocol-evidence.json`. No tokens or cookies
are included in that evidence. Node fetch receives the provider's JSON redirect
envelope. The Next proxy converts this envelope back to an HTTP redirect for
HTML authorization navigation, preserves response cookies and checks local
redirects against the configured site origin (Next can normalize the incoming
request host). JSON clients retain their original response.

Refresh rotation required a compatibility fix: the pinned Convex adapter does
not provide the provider's atomic `incrementOne` operation. The OAuth adapter
handles only its exact refresh-token compare-and-set through the component's
`importRefreshTokens.consume` mutation, and rejects unexpected update shapes.
The mutation accepts a missing/null revocation marker and unexpired token,
records server time and consumes it only once. Tests cover concurrent consumers
and expired tokens; eight OAuth configuration/adapter tests pass. The live
refresh initially failed before this fix and succeeds afterward.

The consent screen at `/import/authorize` uses the shared DESIGN.md AuthShell,
Gelica/Figtree, warm tokens, semantic error and loading primitives, and 44px
buttons. It reads the registered client's public name, shows the signed-in
account and requested import/offline permissions, and requires an explicit
Allow or Cancel. Unsigned/unsupported requests cannot enable consent. Failures
remain visible in the page. The provider sends login requests to
`/import/connect`; the existing sign-in/signup callback preserves the complete
signed query and returns to consent.

Actual browser proof covers desktop Allow, mobile Cancel (access_denied, no
code) and signed-out login through successful consent/code return. Both sizes
have no horizontal overflow and zero automatic WCAG violations in the checked
light-theme state. Captures inspected under `.scratch/oauth-consent-design/`;
machine evidence is `.scratch/url-import-live/oauth-ui-evidence.json`.
The login automation waits for page hydration before filling controlled fields;
an earlier fill before that wait produced an `INVALID_EMAIL` rejection.

Next integration step: resource metadata and scope-limited private MCP import
dispatch. Account saving from ChatGPT is still unimplemented. The new consent
screen's dark-theme/manual accessibility and gallery review remain part of the
delivery gate.

- Implement OAuth account linking with an established provider; verify issuer,
  audience, expiry and scopes before private tools. Existing Better Auth login
  is not by itself a complete MCP authorization server.
- Add authenticated destination/claim/confirm/result tools and their tests.
- Preserve the selection when opening the website from the component.
- Run the actual developer-mode interaction, prepare listing assets and submit
  only after the production endpoint and required release gates are authorized
  and verified. This local server is not a published ChatGPT plugin.

## Current primary sources

Verified on 2026-09-09. Former Apps SDK documentation URLs now redirect to Plugins.

- [OpenAI: build an MCP server](https://developers.openai.com/plugins/build/mcp-server)
- [OpenAI: MCP Apps UI](https://developers.openai.com/plugins/build/chatgpt-ui)
- [OpenAI: OAuth authorization](https://developers.openai.com/plugins/build/auth)
- [Official TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.29.0)

### Scoped Project discovery (2026-09-09)

Implemented protected-resource discovery at `/.well-known/oauth-protected-resource/mcp`
(and the root discovery alias), with the canonical `/mcp` audience and separate
`/api/import-auth` issuer. Both routes respect the local rollout flag.

The app-only `list_import_projects` MCP tool now declares the import OAuth scope.
Missing or rejected credentials return the `mcp/www_authenticate` linking challenge.
The Next route forwards the bearer only to the configured Convex HTTP endpoint,
never to `ConvexHttpClient.setAuth`. The narrow backend endpoint verifies the
signature using Better Auth's database-backed JWKS verification, issuer, audience,
subject, authorized client, exact import scope, expiry, issuance time and 15-minute
maximum lifetime. Each internal query then checks the current client, consent,
verified account, active membership, Project activity and ownership permission.
No generic account API accepts this grant.

Verified with an actual local OAuth code exchange and MCP HTTP tool call: the
synthetic Owner's Willow Ceramics Project appears; missing and forged tokens trigger
linking. Existing refresh rotation/revocation and code-replay checks still pass.
Evidence: `.scratch/url-import-live/oauth-protocol-evidence.json` (no tokens).
The current consent check rejects removed scope or disabled clients. Refresh-token
revocation is verified separately; it is not a claim of immediate JWT revocation.

Private save/claim and the widget Project chooser are implemented below. Actual
ChatGPT host and remote release remain incomplete. This is local protocol evidence only.
Reference: https://developers.openai.com/plugins/build/auth

### Scoped saving and Project chooser (2026-09-09)

The app-only `save_testimonial_import` tool now saves the persisted selection into
an explicitly chosen owned Project. Its private HTTP endpoint verifies the bearer;
a single internal mutation rechecks the current OAuth consent, verified account,
Project ownership and activity, claims the preview and calls the shared import
service. Public website functions still derive their identity from the website
session. The internal helper's verified principal is never a public argument.
Retries return the existing job result, including when the first response was lost.
Imports remain Pending and preserve the original source words. Video processing
uses the existing queue/quota path; real Mux copy/webhook proof remains pending.

The widget now loads/paginates Projects, requires an explicit Project choice,
confirms import, shows the shared result screen and opens the Inbox through the
MCP Apps host bridge. A new preview clears the previous result and stale requests.
An empty Project list currently asks the person to create/activate one on the site;
a complete in-widget account/Project onboarding handoff remains to be completed.

Evidence:

- Actual local OAuth -> MCP select -> save -> retry with one synthetic source row
  succeeded. Job `nx7e3a7dxa0j91cw57fq8ds9x98e26mh`; evidence JSON remains under
  `.scratch/url-import-live/oauth-protocol-evidence.json` without credentials.
- Service regression checks the Pending row, idempotent retry, another Owner's
  Project rejection and revoked consent rejection.
- Full Vitest run passed: 763 tests across 136 files in 22.15s. The later widget
  stale-result reset was verified by TypeScript/lint and the browser flow.
- Desktop/mobile MCP host simulator passes through selection, Project choice and
  save. Automatic WCAG scan passes on the chooser after fixing the simulator's
  missing document language. This is not an actual ChatGPT host verification.
- Local captures: `.scratch/mcp-save-design/`; no GitHub publication yet.

Still required: real host/CSP and listing validation, onboarding handoff,
selected-import Inbox filtering, remaining video reconciliation
and real provider-copy proof, gallery/manual accessibility and delivery/CI gates.

### Customer identity correction in the widget (2026-09-09)

The shared customer-details dialog now calls the app-only
`correct_testimonial_identity` tool. Its temporary preview capability grants no
Account access. The mutation validates the capability, expiry, unclaimed state,
item position, and trimmed name/role limits (100/200 characters). Corrections are
stored separately from source items; the read projection displays them. The
atomic authenticated claim transfers them to the owned import correction fields
and removes the anonymous payload. Duplicate matching still uses original source
identity and quotes. Imported text and video use the existing correction path.

A new widget preview remounts the form and invalidates outstanding requests, so
an old correction cannot silently update a different preview. Failed corrections
keep the dialog open. The shared dialog keeps the DESIGN typography and tokens,
with 44px action targets, and restores focus to the edited row.

Evidence: actual local MCP preview -> correction -> fresh read retains corrected
identity and the same source quote/selection, without importing or publishing.
Recorded in `.scratch/url-import-live/mcp-identity-evidence.json`. Service tests
cover wrong capability, bounds, expiry, claimed state, preserved original source,
claim transfer, cleanup and Pending import. Protocol tests cover app-only metadata,
input validation and capability exclusion from model output. Full suite passed
768 tests across 136 files in 29.41s; subsequent dialog target-size and widget
render-state refinements are covered by the desktop/mobile browser flow.

Browser evidence uses the MCP host simulator, not ChatGPT itself. Both widths
exercise edit, selection preservation, focus restoration, Project choice and save.
Light/dark dialog automatic WCAG scans pass, with verified 44px action targets.
The simulator waits for the host theme transition to settle before measuring
contrast; an intermediate transition colour caused the first mobile dark scan
to fail. Final desktop/mobile captures were inspected in both themes.
Captures are local under `.scratch/mcp-identity-design/`. Actual ChatGPT host/CSP,
listing, onboarding handoff and final delivery gates remain open.

### Inbox scoped to the completed import (2026-09-09)

Website and MCP save results now link to `/org/<slug>/inbox?import=<jobId>`.
Text and video creation record the import batch on the private Testimonial. A
matching internal projection field supports the Published subset in its actual
Wall order. Indexed queries scope every list and count to both Project and import,
with current ownership checked first. The URL identifier grants no access.
Pagination and category counts exclude unrelated imports. Invalid or repeated
query parameters remain an empty scoped view, never a silent unfiltered fallback.
The durable batch reference survives removal of the temporary preview/job.

The Inbox explains its scope, provides a Show all testimonials link and uses
scope-specific empty copy. Wall reordering is available on the complete Inbox;
it is hidden for the filtered subset so absent neighbours cannot be moved by
accident. Imported records without email no longer render an empty separator.

Evidence: 771 tests / 136 files passed in 30.50s before the final separator-only
visual refinement. Targeted tests cover separate batches, counts, pagination,
publication order, job deletion, invalid filter and cross-Project/account access.
TypeScript and targeted ESLint passed. The actual local OAuth/MCP save returned
the scoped URL and its retry returned the same result. The resulting synthetic
import was inspected in the real local Inbox at desktop/mobile widths, both
light/dark: one Pending item, scope retained after reload, scoped empty category,
return to the full Inbox, zero automatic WCAG violations and no horizontal scroll.

Evidence: `.scratch/url-import-live/import-inbox-evidence.json`; captures:
`.scratch/import-inbox-design/`. Only synthetic local data was changed; no
publication or production deployment. Earlier development-only imports created
before the batch field was added do not receive a retrospective association.

### Website continuation for signup and Project creation (2026-09-09)

The widget offers Continue on website from the preview and the Project chooser.
The app-only tool verifies that the shared anonymous snapshot is still available,
then returns a URL solely in result metadata. The URL targets the configured
website origin, with the 256-bit preview capability in its fragment. Neither the
caller nor source content supplies the destination origin or redirect path.

`/import/continue` serves a dedicated HTML document with no application bundle,
analytics or external resources. Its exact inline script is allowed by CSP hash;
all other resources, framing, forms and base overrides are denied. It strips the
fragment with `replaceState`, writes the existing local preview session and
replaces the page with `/import`. Responses are no-store and no-referrer. Invalid
fragments and blocked storage go to a clean failure URL; they do not overwrite an
existing preview. This transfers anonymous preview possession only. Website
authentication and explicit owned Project choice are still required for claiming.

Selection, separate identity corrections, source snapshot, expiry and acquisition
flow stay on the same backend record. The website now also exposes the existing
shared correction dialog before claim. The resume screen shows the actual preview
expiry rather than promising another 24 hours. Public link buttons have 44px
minimum targets. If the host refuses opening the link, the widget keeps the
preview and offers retry without claiming import success.

Evidence:

- Actual local MCP -> isolated transfer -> anonymous website preview -> reload ->
  sign-in -> owned Project claim passed on desktop and mobile with a live provider.
  Selected item, corrected identity and quote survived. No import confirmation or
  publication was performed. An initial duplicate item was correctly excluded by
  destination deduplication; the positive test uses a not-yet-imported item.
- Captured request URLs/referrers contain no capability; model-visible tool content
  contains none. `.scratch/url-import-live/import-handoff-evidence.json` records
  results without tokens, passwords or cookies.
- Six browser boundary tests cover transfer/reload, malformed fragments, unchanged
  previous preview and blocked storage. Two host-simulator flows cover refused
  open/retry, selection preservation and the existing private-save flow.
- Full suite: 773 tests / 137 files pass (32.60s). Subsequent loading-indicator,
  expiry-copy and public target refinements are checked with TypeScript/lint and
  targeted browser verification. Local captures: `.scratch/import-handoff-design`
  and `.scratch/mcp-handoff-design`.

This is not an actual ChatGPT host test. Fresh signup/email verification and new
Project creation were verified earlier for the same website resume path; this
handoff-specific live run used sign-in and an existing owned Project. A combined
fresh-signup handoff run remains part of the final browser audit. Real Mux copy,
actual ChatGPT/CSP/listing, gallery/manual review and delivery/remote CI remain open.

The final expiry-copy and 44px link-target refresh was rerun successfully against
the actual local backend with synthetic preview content. The preceding live-wall
run remains recorded separately. A repeated provider read failed with `fetch
failed` at 13:36/13:37 local time; it was not treated as a successful extraction.
Additional UI evidence: `.scratch/url-import-live/import-handoff-ui-evidence.json`.

## Project video capacity before confirmation

The OAuth-protected Project list now returns current account video storage usage,
limit, availability and provider configuration after the existing ownership and
consent checks. The selected Project shows that capacity before saving; the
Owner can reload Projects or return to selection. Ready videos, reservations
and unresolved provider cleanup use the same capacity calculation as import
confirmation. The display is advisory: confirmation still checks capacity
transactionally. Older responses without capacity show an explicit unavailable
check rather than inventing a zero.

Verified locally: empty capacity, two pending reservations consuming the Free
limit, provider configuration, and desktop/mobile MCP Apps simulator rendering.
This does not prove rendering in actual ChatGPT or real Mux copying.
