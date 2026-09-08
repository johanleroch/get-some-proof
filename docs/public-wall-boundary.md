# Public Wall delivery boundary

The hosted Wall, its metadata and the JSON endpoint use the same Next.js server adapter. Browser refreshes use the JSON endpoint, never the complete Convex projection queries. The server credential is checked before a projection lookup, and the backend accepts at most 50 rows and a 1,024-character cursor. Database page work is capped at 50 rows and 512,000 bytes. The adapter admits lookups before resolving a Brand, then admits reads for that Brand. JSON responses are capped at 1,000,000 bytes. Unsupported parameters and malformed signed cursors are rejected before admission or database reads.

## Entry-point inventory

| Entry                                                         | Access and bounds                                                                                                                              |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosted `/w/[publicSlug]`, including metadata                  | Shared server adapter; React request-local memoization; same lookup and read admission as JSON                                                 |
| JSON `/api/public-wall/[publicSlug]`                          | Public gateway; signed Brand-bound cursors; global and requester admission; public projection only                                             |
| Browser complete Wall reads                                   | JSON adapter; 30-second refresh; refresh retains loaded pagination depth through bounded signed reads; stale content clears on refresh failure |
| Convex `publicWall.getBrand` and `publicWall.list`            | Trusted-server credential; no anonymous complete projection access                                                                             |
| Convex `publicWall.privacyRevision`                           | Intentionally public, single indexed Brand lookup; only a revision number or null, without testimonial, storage or private identity reads      |
| Alternate Next.js deployment hostnames                        | Same adapter and bounds; when the optional gateway lock is enabled, the same origin authentication applies                                     |
| Collection, management links and authenticated workspace APIs | Retain their own existing authentication and admission contracts                                                                               |

The minimal reactive revision is a privacy invalidation signal. Removing a projection or changing public visibility increments it in the same transaction. Starting Brand deletion makes it null. A client immediately hides **all** loaded pages on a mismatch and requests a new admitted snapshot. This preserves the immediate-removal intent of ADR 0026 for connected clients without granting a browser the complete projection credential. Browser suspension or loss of connectivity cannot guarantee instantaneous delivery; the client also refreshes on return to visibility and expires a successful snapshot after 60 seconds. No content cache with a positive freshness lifetime is introduced.

## Credentials and requester identity

| Variable                            | Provider                                                         | Runtime and exact placement                                                                                           | Purpose                                                                                              |
| ----------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `PUBLIC_READ_RATE_LIMIT_SECRET`     | Operator-generated random value, at least 32 characters          | Next.js server environment (`.env.local` locally) **and the selected Convex deployment environment**, identical value | Service authentication for projection reads and admission; also signs Brand-bound pagination cursors |
| `PUBLIC_WALL_ORIGIN_GATEWAY_SECRET` | Separate operator-generated random value, at least 32 characters | Trusted gateway secret store and Next.js server environment only; leave unset until that gateway exists               | Optional authentication of gateway-to-origin Wall requests                                           |

Neither value belongs in a `NEXT_PUBLIC_*` variable, browser storage, rendered props, logs or GitHub. Rotate the read credential in both runtimes together; old cursors become invalid and clients restart pagination. A mismatch fails closed. Rotate the gateway credential in the gateway and origin together; a mismatch rejects requests. This change does not install or deploy a gateway.

On Vercel-managed ingress (`VERCEL=1`), the requester key derives from the platform-overwritten `x-forwarded-for` header. [Vercel request-header documentation](https://vercel.com/docs/headers/request-headers) specifies that external forwarded addresses are overwritten to prevent spoofing. When a verified gateway credential is present, the adapter uses `cf-connecting-ip`: the trusted gateway must overwrite that value from its authoritative connection metadata and replace any incoming origin credential. Other environments use a shared unknown-requester bucket. Arbitrary forwarding headers never select independent requester buckets on standalone hosting. This fallback intentionally shares the requester budget; configure authenticated ingress before expecting per-visitor capacity there. Global admission remains active in every case.

## Optional gateway origin lock

Set the origin credential only after routing both hosted Wall and JSON paths through the gateway. The gateway must strip incoming `x-gsp-origin-secret`, inject its stored value and overwrite requester metadata. Requests to any origin hostname without the matching credential return a non-cacheable rejection before database work. Hostnames, CORS and the presence of a forwarding header alone provide no authorization. A configured empty or short credential also fails closed.

Isolated request-handler tests exercise missing/forged credentials across canonical, preview and alternate hostnames, plus valid gateway access. A future staging rollout must additionally verify the real ingress configuration and gateway injection, then test each reachable deployment hostname. Unit tests cannot establish that infrastructure is deployed or that a proxy overwrites headers correctly. Cloudflare rollout remains in its separate delivery issues.

Successful cacheable JSON responses contain public content and ETags, with no requester-specific remaining/reset counters. Failed admission and configuration responses use `no-store`.
