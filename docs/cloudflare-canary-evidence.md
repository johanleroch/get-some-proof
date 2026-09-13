# Cloudflare Widget canary (#169)

Implementation scope: a one-shot text-only publication, in staging only. Parent contract: [#168](https://github.com/johanleroch/get-some-proof/issues/168). Base: `e9639e47c114802d61b3c669fbc1331ba2f6467b`; incorporates the approved documentation from `cc36b1262b49190419b73bcd62d3e381ead2c82a`.

## Provider inspection — 2026-09-13

Read-only Wrangler OAuth inspection succeeded. Account `c5766b3d8c072b152df6d2f818707089` has Workers/KV write scopes and `johanleroch-pro.workers.dev`. Existing Workers: `atrakt`, `order-eat-analytics`. Neither was changed. The initial KV namespace list was empty. Active zones `atrakt.agency` and `johancode.fr` report Free Website; `getsomeproof.com` is absent. Worker account settings report `default_usage_model: standard`; this does **not** prove a paid subscription. The subscriptions endpoint returned HTTP 403. Actual invoice, taxes, billing currency and existing account usage remain unverified.

No paid subscription or production routes are needed for this canary. New resource: namespace `staging-PUBLICATIONS`, ID `dc6e51788692498dad78ddbf0f34ca55`. Target Worker: `gsp-widget-canary-staging`. Config has no production environment, custom domain or zone route. Local binding `canary-local-only` is distinct from remote staging.

## Cost baseline before provisioning

This tranche needs one Worker with Static Assets plus one KV namespace. Staging certification expects fewer than 100 writes and 1,000 reads. Incremental cost is expected to be $0 within available Free allowances; this is a forecast, not an invoice. Free quotas fail closed when exceeded. Existing account workloads share the allowances.

For a minimal future staging + production topology (two Workers, two namespaces; no R2 needed for text), Workers Paid has a $5/month account minimum, 10 million requests and 30 million CPU-ms; KV includes 10 million reads and 1 million writes per month. At 1 million visitor loads, 1 KV read/load, 5 ms CPU/load and 1,000 surfaces renewed twice/day (60,000 writes/month), the modeled monthly service charge is $5 before tax and currency conversion, assuming no other account usage consumes allowances. Static asset requests are free when asset-first. At 20 million loads and 5 ms CPU/load, model $5 + $3 requests + $1.40 CPU + $5 KV reads = $14.40/month. These are scenarios, not measured CPU or traffic. No USD/EUR equivalence is assumed; the EUR 10–20 target requires exchange-rate, taxes and account-usage verification before paid provisioning. See the fuller [cost model](cloudflare-delivery-costs.md), including later media and renewal costs.

Primary inputs rechecked: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/), [Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/). No paid provisioning performed.

## Credentials and placement (values deliberately excluded)

| Provider          | Runtime                    | Purpose                                            | Placement                                                                                          |
| ----------------- | -------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Cloudflare        | Local Wrangler CLI         | Deploy the dedicated staging Worker and namespace  | Existing local OAuth configuration; not copied into CI                                             |
| Cloudflare/Convex | Worker + Convex dev action | Authenticate publication PUT only                  | `CLOUDFLARE_CANARY_PUBLISH_SECRET` in Worker secret storage and Convex dev env                     |
| Convex            | Local CLI                  | Push dev functions and run synthetic Owner actions | Existing CLI authentication; explicit `content-mosquito-795` target                                |
| Convex            | Dev action                 | Pin source deployment and staging destination      | `CLOUDFLARE_CANARY_SOURCE_URL`, `CLOUDFLARE_CANARY_DELIVERY_URL`, `CLOUDFLARE_CANARY_ENABLED`      |
| Cloudflare/Convex | Worker + dev source        | Explicit canary origin policy                      | Worker `ALLOWED_ORIGINS` and Convex `CLOUDFLARE_CANARY_ORIGINS`; currently `http://127.0.0.1:8790` |

No Cloudflare API credential is put in Convex or browser assets. CI runs local workerd with a synthetic test secret only. A dedicated least-privilege deployment token, billing-read access, production resources and production cutover are later authorized operations.

## Publication and runtime contract

The Owner first publishes the existing Widget, then invokes `cloudflarePublication:publish` with its Project and Widget IDs. Authorization, active Project/plan eligibility and current public projection run server-side before an atomic one-shot reservation. The source calls the shared renderer and sends a bounded versioned envelope. Known public fields are whitelisted; internal projection IDs become publication-local opaque display IDs. Drafts, credentials, consent and tenant IDs never enter the payload. Media and remote fonts are rejected until their delivery slices are implemented.

The reservation survives success, timeout and provider error. A second or concurrent call is denied before external I/O. This canary deliberately has no replacement, retry, automatic renewal or lifecycle propagation; those remain #171. A failed attempt needs a fresh synthetic Widget, never manual reservation deletion. No competing stale writer is started. This restriction must remain until the durable lifecycle coordinator is certified; the canary is not a production cutover mechanism.

The Worker validates route, method, origin, schema, identity, byte bounds and absolute validity (maximum 24 hours). Missing, malformed, expired or unavailable publications fail closed. Visitor paths have no outbound fetch, generation, redirect or application fallback. Browser data responses are no-store; origin headers are set after authorization with `Vary: Origin`. KV consistency remains eventual; a warm read may see a previous valid value. Origin policy is browser policy, not authentication against arbitrary servers.

The independent build minifies the existing embed renderer with a Cloudflare build flag. Assets live under an immutable hash path with a stable loader. Only this build keeps open-page content beyond 60 seconds. The default app embed path remains compatible until its later explicit migration. Static runtime delivery is asset-first. The canary only observes Widget mounts, not existing Wall selectors.

## Evidence ledger

- TDD: publication test missing interface -> green; media/metadata bounds red -> green; Worker invalid/missing/expired/origin/schema cases red -> green; browser reproduced legacy 60-second clearing -> fixed independent build.
- Real local workerd: desktop/mobile content, empty and unavailable browser tests passed; separate-origin page, application/external network deny assertions and bounded reads.
- Remaining delivery gates are recorded below as they are actually verified. This document does not itself mark #169 complete.

## Actual staging run

At `2026-09-13T07:05:58.704Z`, the Owner action on `content-mosquito-795` published synthetic Widget `29200be1-a78e-4049-a2ca-82a3e67a816f`. Initial Worker version `30a3bc2c-aad1-43ce-b982-fa1dd7a62404` was deployed before secret configuration. A read-only `wrangler deployments list` verified active version `ecacf032-2458-4d27-9ad8-5be8d77ae5bb` at 100%, created by Secret Change at `2026-09-13T07:04:01.762Z`, before the recorded browser run. Its runtime asset hash is `ef3324ef7af67909d897`, matching the independent build. The synthetic Project is Cedar Workshop, with Maya Laurent's text proof; no real customer data or outbound email was used.

The actual [staging Worker](https://gsp-widget-canary-staging.johanleroch-pro.workers.dev) served the loader, hashed renderer and Widget data to a separate-origin localhost page. Desktop and mobile each loaded and reloaded successfully: exactly two Widget data requests per browser, no forbidden application/external requests, no polling and content retained after advancing browser time by 61 seconds. All asset/data responses were HTTP 200 with Cloudflare Ray IDs recorded in [the run trace](cloudflare-canary-run.json). This proves a first browser load and repeat load through Cloudflare, not a forced purge of every Cloudflare POP cache. Local adapter tests cover deterministic missing and stale KV states.

Convex dev push succeeded. Its output also reported removing the pre-existing `googleBusinessConnections.by_stateHash` and `.by_organizationId` indexes, which were absent from the selected main schema. This was the shared development deployment, not production; no data deletion was run. Do not infer this dev is an isolated per-branch Convex deployment.
