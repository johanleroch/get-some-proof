# Connected review providers

The import screen accepts a list of connector panels. It does not branch on
Google or assume that a connector uses OAuth, Pub/Sub, or a two-level account
and location hierarchy. Installed connectors are declared in
`src/components/review-connectors/registry.tsx`.

The shared `useReviewBrowser` module owns selection, opaque pagination cursors,
loading, notification invalidation, burst coalescing, bounded transient retries,
and discarding stale responses. Its read interface receives a resource path and
cursor. A provider translates that request to its own endpoint parameters.
Each mounted connection has independent state; a new authorization generation
remounts it to discard data from the old identity.

Provider review records are normalized to `ConnectedReview` before the shared
`ReviewList` renders them. Rating enums and external response shapes stay in the
provider adapter. Provider-specific resource selection and notification consent
remain in that provider's view.

Google's backend is an isolated adapter: credential lifecycle and permissions in
`convex/googleBusiness.ts`, provider HTTP/OAuth/encryption in
`convex/lib/googleBusinessClient.ts`, review reads in
`convex/googleBusinessActions.ts`, and signed Pub/Sub ingestion in its notification
modules. No other connector needs to import these modules or reuse its credentials.
Credential storage and webhook verification intentionally remain provider-specific;
there is no generic credential blob or unauthenticated catch-all webhook.

## Adding the next connector

For Trustpilot (or another provider):

1. Implement its server adapter using that provider's documented authorization,
   access rules, pagination and data-use policy. Keep credentials server-side and
   check Project ownership for every exposed operation.
2. Provide a stable read function to `useReviewBrowser`. Map returned reviews to
   `ConnectedReview`. A one-resource provider passes one selection ID; it does not
   invent a Google account or location.
3. If automatic updates are supported, authenticate them in that provider's
   endpoint, deduplicate them in its own namespace, and expose a monotonic revision
   for the selected resource. Otherwise omit updates; manual refresh still works.
4. Register its connection panel in `registry.tsx`. The import screen and browser
   state machine need no edits.
5. Test authorization, response mapping and its real provider workflow. The
   common browser tests already exercise independent connectors, arbitrary
   resource paths, stale responses and retry after notification failure.

Trustpilot is not implemented or shown as available. This extension point avoids
duplicating the review browser; it does not claim all future providers share
Google's authentication, notification semantics or publication permissions.
