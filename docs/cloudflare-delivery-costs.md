# Cloudflare delivery: costs and operational constraints

Research checked 2026-09-13 against Context7 and current primary Cloudflare documentation. This is a planning model, not an account audit or purchase. Owner target: **EUR 10–20/month for Cloudflare only**, excluding Convex, Vercel and Mux. Prices below are USD before tax; do not equate USD with EUR. Confirm account usage, billing currency, taxes, available zone features and exchange rate before paid provisioning.

## Verified price and limit inputs

| Service               | Included usage and overage                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workers Paid Standard | $5/month account minimum; 10 million requests and 30 million CPU-ms included; then $0.30/million requests and $0.02/million CPU-ms.                                                 |
| KV on Workers Paid    | 10 million key reads/month, then $0.50/million. Writes, deletes and list requests each have 1 million/month included, then $5/million. Storage: 1 GB included, then $0.50/GB-month. |
| R2 Standard           | 10 GB-month, 1 million Class A and 10 million Class B operations/month included. Overage: $0.015/GB-month, $4.50/million Class A and $0.36/million Class B. No Internet egress fee. |

Sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

Workers Paid is independent of Free/Pro/Business **zone** subscriptions. Allowances are shared with other account workloads; isolated names or projects do not reserve them. Workers Free has daily ceilings, including 100,000 Worker requests; KV Free has 100,000 reads and 1,000 each writes/deletes/list requests per day, with failures after limits. Paid removes these daily operation ceilings, not billing. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/)

KV charges per key, including absent keys and keys in bulk operations. Its internal cache does not make a `get` free. A value can hold 25 MiB; keys 512 bytes, metadata 1,024 bytes; same-key writes remain limited to one/second. Current documented minimum `cacheTtl` is 30 seconds; default is 60 seconds. Set a much smaller application publication-size limit and test oversized walls. [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/), [KV limits](https://developers.cloudflare.com/kv/platform/limits/), [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/)

R2 GET/HEAD are Class B; PUT/LIST and multipart steps are Class A. Deletes are free. Usage rounds up to billing units. The cited pricing page does not establish a general exemption for failed/unknown-object reads: conservatively count them and verify billing behavior rather than claiming 404 traffic is free. Use Standard, not Infrequent Access, for delivery. [R2 pricing](https://developers.cloudflare.com/r2/pricing/)

Static Assets served directly have no storage fee and free, unlimited requests. Worker-first routing invokes billable code; do not accidentally put shared JS/CSS/fonts behind it. The newer Workers Cache also charges cached requests at Worker request rates; it saves CPU on hits, not request charges. Limits: 20,000 assets/version Free, 100,000 Paid, 25 MiB/file. [Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)

## Load model and budget decision

These are **calculated scenarios**, not measured traffic. A load fetches one config plus five R2 media objects. Config: one Worker invocation and one KV publication read. Each media request: one Worker invocation and one KV grant read **before** the byte-cache lookup, allowing revocable access even on cache hits. If implementation uses separate policy/publication lookups, each extra key increases cost. JS/CSS/catalogue-font requests use direct Static Assets. No polling, browser-cache savings, batching benefit or attack mitigation discount is assumed.

Assume 2 ms CPU per Worker invocation, 100 GB-month R2 storage, less than 1 GB KV, upload operations within included allowance, no paid transformation service. Thus per load: **6 Worker requests + 6 KV reads + 5 × (1 − media-cache hit ratio) R2 GETs**. Cache hit ratios below concern R2 bytes only, not permission reads.

| Loads/month | Worker/KV reads each | R2 GETs at 95% / 50% hits | Delivery subtotal at 95% / 50% hits |
| ----------- | -------------------- | ------------------------- | ----------------------------------- |
| 100,000     | 600,000              | 25,000 / 250,000          | $6.35 / $6.35                       |
| 1 million   | 6 million            | 250,000 / 2.5 million     | $6.35 / $6.35                       |
| 10 million  | 60 million           | 2.5 million / 25 million  | $48.15 / $53.55                     |

Subtotals include $5 base + $1.35 R2 storage. At 10 million loads, Worker requests add $15, CPU $1.80, KV reads $25; the 50%-hit case adds $5.40 R2 reads. They exclude publication/control processing, staging, taxes, logs and other account workloads; calculate those separately. Arithmetic uses the tariff inputs above. A config-only calculation would hide the dominant media authorization costs.

For renewal sizing, 1,000 publications plus 5,000 independently expiring media grants renewed twice daily produce **360,000 KV writes per 30-day month**, before edits, retries and fan-out. Below the included million writes; 10,000 ordinary changes still fit. Batch control delivery so grants do not each require a separate HTTP request. Count actual Worker calls, KV reads, serialization service and CPU from the selected publication implementation. At 10,000 publications with the same grant ratio, renewals alone become 3.6 million writes, adding $13 above the included million. Catalogue/public static media need no grants if explicitly non-revocable.

Under these assumptions, early usage has budget headroom; 10 million loads does not fit the stated envelope. Do not promise a maximum load capacity without image counts, grants, CPU and cache measurements. Never solve cost pressure by silently removing accepted revocation controls.

## Publication validity and ordered writes

KV is eventually consistent, with changes taking 60 seconds **or more**, including negative lookups; it is unsuitable as a transactional revision lock. [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/)

Implementation requirement: publish an absolute `expiresAt` derived from authoritative validation, at most 24 hours later. Renew at intervals no longer than 12 hours, only after validating current publication rights. The delivery Worker checks that timestamp on every new response, including cached bytes; never extend it on a read, retry or copy of stale data. KV expiration is useful cleanup and overrides KV cache TTL, but cannot replace an application check across every response-cache path. Already displayed browser content stays until explicit reload, as accepted. [KV expiration](https://developers.cloudflare.com/kv/api/write-key-value-pairs/)

Serialize publication, withdrawal and renewal for each stream. Use monotonic revisions and idempotency; reject older/replayed writes in a strongly consistent writer, not by reading KV first. Cloudflare recommends a single write stream, optionally a Durable Object. A Convex outbox alone needs a proven single active writer across retries/timeouts; otherwise a late HTTP write can overwrite a withdrawal. Keep tombstones long enough to reject delayed retries, and never let old publications mint fresh media grants. Stale reads remain accepted; stale writes must not resurrect content. [KV concurrent writes](https://developers.cloudflare.com/kv/api/write-key-value-pairs/)

## Protection available without assuming a paid zone

A Free zone currently offers one WAF rate-limit rule, path/verified-bot filtering, IP counting and 10-second counting/mitigation periods. It cannot supply arbitrary global per-project counters. Workers Paid does not upgrade these zone entitlements. [WAF availability](https://developers.cloudflare.com/waf/rate-limiting-rules/)

Worker rate-limit bindings accept resource-specific keys but counters are per Cloudflare location, permissive and eventually consistent, not accurate accounting. Use for early rejection before KV/R2; combine with targeted suspension, bounded inputs and usage alerts. Distributed attacks can span locations, and rejected Worker requests can still cost money. Domain allowlisting is browser integration control, not attacker authentication. Confirm binding availability in the actual account during setup. [Rate-limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)

There is **no demonstrated EUR 20 hard cap** here. Set CPU limits, monitor all services and test suspension paths; measure peak false positives before selecting thresholds. Disable alternate public endpoints that bypass control. Infrastructure readiness must document actual subscriptions and present any paid upgrade separately; this research authorizes none.
