# Cloudflare delivery for Walls, Widgets and product media

## Problem Statement

Public proof currently depends on Next.js/Vercel and Convex for visitor reads, while images and uploaded fonts are delivered from Convex and generated thumbnails from Mux. Traffic or abuse on a customer website therefore creates application work and potentially expensive data transfer. The Owner wants independent public delivery, coherent media storage, predictable operating costs and a migration that preserves installed integrations and private workflows.

## Solution

Publish complete public-safe Wall and Widget representations from Convex into Cloudflare Workers KV. Serve visitors through a dedicated Cloudflare Worker, distribute the rendering runtime with Workers Static Assets, and store product images and uploaded fonts in private R2 storage with controlled delivery. Visitors never trigger Next.js or Convex work, including misses, missing identifiers, cursor navigation and media requests.

Keep Convex authoritative for editing, authorization, consent, plan eligibility and publication workflows. Keep the dashboard and Collection Forms on Next.js. Move hosted Public Walls and hosted Widget views to the same independent Cloudflare rendering/delivery model. Keep video processing and streaming on Mux; serve selected still images and player runtime dependencies from Cloudflare.

Accept KV's eventual propagation, including delays of 60 seconds or more. Pages already open retain their rendered content until an explicit reload; there is no polling, timed refresh or automatic 60-second clearing. Newly obtained publications require current delivery validity.

## User Stories

1. As an Owner, I want an installed Widget to work without my application serving visitor requests, so that customer traffic does not overload my backend.
2. As an Owner, I want Public Walls and hosted Widget links to use the same independent delivery, so that shared links have the same protection.
3. As an Owner, I want the existing dashboard and collection workflows to remain available, so that this migration does not interrupt my work.
4. As an Owner, I want private draft edits to stay private until publication, so that experimentation does not change my live Widget.
5. As an Owner, I want a complete publication to become active together, so that visitors do not see mixed revisions.
6. As an Owner, I want every affected Widget to update when its Testimonials change, so that I do not have to republish each manually.
7. As a Submitter, I want consent withdrawal and revisions propagated to every published copy, so that removed proof is not intentionally retained.
8. As an Owner, I want changes to plan eligibility and visibility to reach published copies, so that the public output follows my current rights.
9. As an Owner, I want an interrupted ordinary publication to preserve the last valid version for at most 24 hours without renewal, so that temporary outages do not immediately erase my proof.
10. As an Owner, I want failed publications to retry safely and expose their status, so that errors do not remain invisible.
11. As a visitor, I want readable proof without background polling, so that a page does not keep generating requests.
12. As a visitor, I want an unavailable Widget to fail quietly and without retries to the application, so that it does not disrupt its host site.
13. As an Owner, I want to declare permitted embedding sites for my Project, so that a copied snippet does not normally work elsewhere.
14. As an Owner, I want to test at an explicitly declared localhost origin and port before launch, so that I can integrate locally.
15. As an Owner, I want separately declared staging and production sites, so that shared hosting providers are not trusted wholesale.
16. As an Owner, I want domain declaration without DNS verification initially, so that setup remains lightweight.
17. As an Owner, I want existing snippets to continue working during a controlled transition, so that customers do not need an emergency reinstall.
18. As an Owner, I want compatible runtime updates automatically and a controlled rollback, so that installations remain maintainable.
19. As a Submitter, I want uploaded photos and attachments to keep their existing image quality and limits, so that migration changes storage rather than the content.
20. As an Owner, I want Brand logos, account photos and customization images to use the same managed media lifecycle, so that files are consistently tracked.
21. As a Submitter, I want unpublished images to remain private and public access to stop after withdrawal, so that knowing an old URL does not grant permanent access.
22. As an Owner, I want archived media to remain privately available, so that public removal does not prevent private moderation.
23. As an Owner, I want the selected video frame or uploaded Thumbnail to be delivered from Cloudflare, so that browsing proof does not repeatedly fetch Mux still images.
24. As a visitor, I want video playback to remain intent-loaded and functional, so that this migration does not eagerly download videos.
25. As an Owner, I want inherited, catalogue and uploaded fonts to keep working, so that typography remains configurable.
26. As a visitor, I want selected fonts supplied by Get Some Proof to load from Cloudflare with readable fallbacks, so that external font services are not required.
27. As an Owner, I want files grouped by stable Project identity with useful metadata, so that storage can be inspected and cleaned reliably.
28. As an Owner, I want export, backup and restore to include the new media references, so that portability still works.
29. As an Owner, I want a dry-run inventory and verified migration of existing assets, so that no broken media is silently accepted.
30. As an Owner, I want old Convex copies retained for seven days after a validated cutover, so that a rollback is possible.
31. As a Submitter, I want deletion to cover both providers during that retention window, so that rollback storage does not defeat withdrawal.
32. As the service operator, I want invalid and abusive requests bounded before costly processing, so that a customer incident has limited impact.
33. As the service operator, I want progressive limiting and targeted suspension with controlled recovery, so that one attacked Widget need not stop every Project.
34. As the service operator, I want meaningful counters, alerts and a cost model, so that the initial Cloudflare-only budget remains within EUR 10–20 per month where the measured workload permits.
35. As the service operator, I want staging evidence before any production action, so that cutover and cleanup are reviewable.
36. As an Owner, I want host-site typography and multiple Widgets on one page to work, so that the embedding contract remains compatible.
37. As a visitor, I want accessible layouts, highlights, source attribution, links and media to retain their current behavior, so that delivery changes do not degrade the product.
38. As an Owner, I want the current Public Wall ordering, Widget selections and Free/Pro branding rules preserved, so that this infrastructure work does not redesign the product.

## Implementation Decisions

### 1. Authority and module interfaces

Use three high-level testable interfaces: publication/delivery, media lifecycle, and existing browser rendering. Reuse the current Public Projection, Widget configuration and shared renderer rather than inventing a second product model. Keep serialization, delivery-provider calls, retry coordination and ownership checks behind these module interfaces. Adapt existing image registry and deletion workflows using an expand–contract transition so old and new references coexist until verified cleanup.

Convex holds source records and desired revisions. KV holds the complete public representation, not IDs requiring visitor-time hydration. R2 holds binary media. Next.js is absent from the public visitor request graph, including hosted HTML, pagination, scripts, player dependencies, fonts, media, alternate routes and legacy snippets. Private Owner operations and collection may still use the application. Navigating voluntarily to signup or a Collection Form is not an embed resource request.

### 2. Publication contract

Define a versioned, bounded public envelope containing surface identity, schema version, publication revision, project delivery-policy revision, generated-at and absolute valid-until timestamps, public-safe Brand identity/configuration, selected public Testimonials, safe media/font references and pagination information where needed. Use opaque public identities; private tenant IDs, emails, consent evidence, audit data, secrets and unpublished drafts never enter browser payloads.

A new Widget publication activates only after its selected content and required R2 media are ready. Updating private drafts does not publish. Public projection changes automatically enqueue all affected surface publications. Preserve existing selection limits and payload bounds; partition large Walls into bounded revision-consistent pages instead of allowing arbitrary visitor queries. A continuation binds the surface and revision and cannot expose arbitrary KV keys or stale eligibility indefinitely.

Keep publication state and embedding policy coherent within a revision or through a specified safe ordering protocol. KV has no compare-and-set transaction for this workflow: a consumer-side comparison alone cannot fix out-of-order writes to a mutable key. Serialize/fence publishing per surface, keep durable work/tombstones, handle an unknown-result write without starting a competing stale writer, reconcile after crashes, and prove old jobs cannot become the lasting active state. Do not claim linearizable public reads: KV may return an earlier valid value while propagating.

### 3. Complete lifecycle coverage and validity

Regenerate or disable every affected publication for publication, archival, Spam, deletion, Submitter revision or withdrawal, optional identity visibility changes, Brand identity/slug/logo changes, selected media or highlights, font changes, Project/Account deletion, subscription/grace/downgrade/Free-Project selection and asynchronous video state changes.

A last valid publication may be accepted for at most 24 hours since a successful authoritative renewal. Store an absolute timestamp and check it in the Worker and relevant delivery authorization; a cache TTL or KV expiration alone is insufficient. Renew only after validating current source eligibility, in bounded scheduled batches independent of visitor traffic; include this recurring work in the cost model. Stale failure paths cannot extend validity by copying old timestamps forward. Withdrawal/deletion is priority work and cancels older refresh jobs; no ordinary-failure fallback intentionally renews withdrawn proof.

Pages already rendered are not remotely recalled, polled or cleared by a timer. New loads and user-initiated pagination/media requests must enforce their applicable validity and current available policy. Refreshing a page may still see KV propagation delay; do not describe it as guaranteed instantaneous freshness. Discontinue the old 60-second auto-expiry behavior for open embeds.

### 4. Domains and browser contract

New external installations require at least one explicitly declared embedding origin per Project. Support HTTPS production sites and explicitly entered local HTTP origins including the chosen localhost port. Treat apex, www, preview hosts, IP loopback aliases and other ports as separate entries unless the Owner explicitly adds them. No broad wildcard for shared hosting providers, no automatic trust of the first observed caller, and no DNS verification in this version.

Validate normalized origin at the Worker before returning a payload. Missing/null origins are denied on the external embed data path, with separately documented internal preview and hosted-surface routes. A publicly shared hosted Wall remains intentionally navigable without pretending its visitors belong to the embedding allowlist. The shared static runtime remains publicly cacheable.

Origin/CORS is browser embedding policy, not authentication or DDoS protection. A server can spoof these headers. Keep response CORS policy outside cached content; never leak one allowed origin's headers to another. Cache hits and alternate hosts cannot skip the policy. Domain removals inherit eventual propagation.

### 5. Media lifecycle and naming

Migrate all product images: Submitter Photos, Testimonial Images, uploaded and generated Thumbnails, Brand logos, customization images and Owner account photos. Include existing imports and management/revision paths. Preserve normalized WebP profiles, validation, upload reservations, content checks and metadata stripping. Avoid sending image bytes through Next.js; existing trusted transformation work may remain an authenticated/control-plane action. New upload intents, object ownership and final attachment are verified server-side.

Use separate environment resources. Adopt Project-first keys with stable project, asset, kind, variant and content-hash segments; use an Account prefix for Account-owned photos. Runtime artifacts use immutable release/hash paths. Names and email addresses are absent from keys. Keep authorization state outside key names; prefixes are organizational and do not isolate billing.

The selected object convention is `projects/{opaqueProjectId}/{kind}/{assetId}/{variant}/{sha256}.webp`, with stable kinds `submitter-photos`, `testimonial-images`, `thumbnails`, `brand-logos` and `customization-images`. Account photos use `accounts/{opaqueAccountId}/profile-photos/{assetId}/{variant}/{sha256}.webp`. Uploaded fonts use `projects/{opaqueProjectId}/fonts/{fontId}/{revision}/{sha256}.woff2`; catalogue faces use `catalog/fonts/{familyId}/{version}/{subset}/{style}-{weight}.{sha256}.woff2`. Runtime releases use `releases/{releaseId}/{assetName}.{contentHash}.{extension}` with a stable loader pointing to a retained compatible release. These are storage-key conventions, not authorization grants or public exposure of internal database IDs. Map public delivery URLs through opaque asset identities. Kind-first and asset-first layouts were considered; Project-first makes inventory, export and deletion by owner easier without relying solely on metadata scans.

R2 objects have correct MIME/cache headers and technical metadata: schema/transform version, asset/project identity where applicable, kind, variant, dimensions, SHA-256, source and creation time. The registry remains authoritative for consent, tenancy, references, migration and deletion. Do not expose internal metadata through public responses. Preserve the rule against cross-Project sharing of private uploaded blobs.

Use private R2 origins with controlled Worker delivery for revocable customer media, and no public alternate hostname bypass. Unpublished media requires an Owner or authorized Submitter capability issued through the private workflow. Published media authorization comes from the Cloudflare delivery state, never visitor calls to Convex. Check authorization before returning a cached object; expired access and revoked copies cannot be bypassed by a known object URL. Scope and bound capabilities, record expiry semantics and include authorization KV/Worker operations in costs.

Browser caches must revalidate revocable media and publications on reuse; a long browser `immutable` lifetime cannot bypass a new request's access/validity check. Cached binary bodies may remain at the edge behind the authorization check, with correct conditional-response handling. Public runtime and licensed catalogue artifacts can use long immutable caching. Revocation cannot recall bytes already downloaded or content already rendered in an open page.

Retain private Owner access to archived media while revoking public delivery. Replacement, expiry, Spam retention, withdrawal, permanent deletion, Project and Account deletion and orphan cleanup cover R2 and any retained Convex source copies. Provider deletion failure is retried and observable. Export/backup/restore validates trusted Cloudflare media references and preserves content portability without SSRF or credential leakage.

### 6. Thumbnails, fonts and runtime

Materialize default Mux stills and Owner-selected video frames before publication, as well as custom uploaded Thumbnails. Refresh when the selected frame or video changes; handle late callbacks, failed conversion and deletion races. Keep Mux video processing/playback and intent-based video loading; private selection tools may contact Mux but published still URLs use Cloudflare.

Keep font inheritance/system fallbacks. Supply catalogue fonts from Cloudflare after offline/control-plane preparation and approved self-hosting terms; dynamically ingested catalogue assets may use R2 rather than requiring visitor-time downloads. Uploaded fonts use Project-scoped R2 storage, original applicable limits and safe metadata. Load only necessary faces/weights/character coverage with CORS, isolated family names and fallback. Do not silently redistribute application-only licensed fonts. Update publications on font removal or entitlement changes.

Use one compatible, versioned runtime across public hosted and embedded views. Preserve all current templates, selection/order, typography, highlights, branding, accessibility, links, source icons and media aspect ratios. Audit every resource, including HTML/CSS images, decorative assets, fonts, captions and player dependencies, so unexpected Next.js/Convex or Mux-thumbnail requests do not survive. Existing v1/v2 installation URLs may need Cloudflare routes on their old host; require an actual routing/TLS feasibility proof. A CDN that still forwards those resources to Next.js fails the requirement.

### 7. Abuse and operating cost

Build progressive admission and targeted suspension by Project/Widget, with privacy-safe alerts, controlled recovery and no interactive CAPTCHA for reading proof. Reject malformed IDs, unbounded cursors, unsupported query strings and invalid methods before unnecessary storage work. Bound negative lookups, valid distinct-ID traffic, retries and response sizes. Test multi-widget pages and shared IPs before selecting limits.

Inspect available Cloudflare zone/Workers plans and supported security features read-only before provisioning. A paid Workers plan does not automatically grant paid zone WAF capabilities. Keep private dashboard and collection available during public-delivery suspension. Enforcement should operate from existing Cloudflare state even during a control-plane outage; asynchronous metrics alone do not provide real-time protection.

The initial target is EUR 10–20/month for all Cloudflare charges only, with future increases requiring a conscious decision. Present USD provider prices separately from taxes/exchange conversion. Model baseline fees, configuration and media authorization reads, unknown keys, R2 cache misses, writes, 24-hour validity renewal, telemetry, storage and staged environments. KV cache hits remain read operations. Alerts and rate limits are not a guaranteed spending cap. Establish a feasible workload envelope and costed controls before enabling production; do not silently exceed the budget or weaken media privacy to make the estimate fit.

### 8. Migration, rollout and documentation

Inventory assets and surface consumers without changing production. Support dry run, bounded resumable batches, checksums/type/size verification, unchanged-source checks, retries, ownership attribution and per-asset outcome. Never activate a reference to an unverified copy or resurrect an object deleted during copying. Stage all supported lifecycle and export cases with synthetic data.

Backfill declared domains only from Owner-approved values; show suggestions rather than trusting observed referrers. Preserve existing integrations through a documented compatibility transition. Keep runtime rollback separate from source-media rollback: after cutover, reverting runtime must still use Cloudflare and retained compatible publications, not restore visitor backend calls.

Retain old Convex media for seven days after the validated cutover. Withdrawal/deletion covers both providers immediately through the priority workflow and does not wait for retention. After the window, verify no live references require a source before cleanup; provide separate verified cleanup evidence. New R2-only uploads and replacements must remain usable during rollback.

Update the glossary, privacy/publication explanations, affected ADRs, setup and operational documentation so accepted eventual propagation, explicit reload, 24-hour new-load validity and the seven-day rollback window are not confused. Accepted design is not evidence of deployment.

## Testing Decisions

Test externally observable behavior at the publication/delivery module, media lifecycle module and real renderer. Reuse current Convex behavior tests, public delivery contract tests, image processing/deletion/export tests and separate-origin Playwright fixtures. Use controlled clocks and faithful KV stale-read/provider-failure adapters for deterministic races; also certify actual isolated Cloudflare behavior without promising a fixed propagation time.

Required proofs:

- Public-only field allowlist, wrong-Project refusal and private-draft isolation.
- One publication renders while Next.js and Convex network routes are denied, on both cold and warm delivery paths.
- Every lifecycle event updates all affected copies; delayed/duplicate/unknown-result publishing cannot permanently restore revoked state.
- Expired 24-hour publications and authorization are refused on new requests; healthy eligible records renew independently of visitors; already-open pages make no periodic requests and are not automatically cleared.
- Allowed origins, explicit localhost ports, forged/non-browser origin limitations, missing/null denial, hosted routes and cache/CORS isolation.
- Private uploads and public media replacements, direct-URL revocation, cache authorization, thumbnail regeneration, fonts and safe export/restore.
- Bounded bad/unknown/valid-ID traffic, targeted suspension/recovery, backend outage, protection operating without callback dependence and a complete workload cost ledger.
- Existing/new snippets, hosted links, all templates, multiple independent/duplicate Widgets, pagination, keyboard/touch/reduced motion, responsive layouts and lazy video.
- Migration interruption, concurrent deletion/replacement, verified rollback, seven-day cleanup including active deletion during retention.

Run appropriate local gates, clean-clone validation for new dependencies/build/release paths, independent Standards and Spec review and successful current-head remote CI. Publish only changed desktop/mobile visual states as GitHub attachments through gh-image. Mark acceptance criteria only from verified evidence. Bounded synthetic staging tests are authorized by implementation work; no production DDoS test.

## Out of Scope

A new video streaming provider; moving private dashboard/collection rendering to Cloudflare; Redis; a duplicate R2 JSON store; visitor polling or forced clearing of open pages; a strict 60-second or instant global revocation promise; DNS verification of embedding domains; new templates, quotas/prices or analytics product; a guaranteed invoice cap; automatic paid plan upgrades.

This specification/ticket publication does not authorize implementation, production DNS/Convex mutations, migration execution, merging, paid subscriptions or deletion of production sources. Production cutover and delayed cleanup remain a separately tracked execution gate.

## Further Notes

This specification synthesizes the Owner's completed interview on 2026-09-13. The Owner explicitly delegated preparing and publishing the specification, dependency-linked GitHub issues and an implementation handoff; routine decomposition follows that authorization without reopening approved product decisions.

Supersession: this specification replaces the public-delivery architecture and freshness assumptions of #65 for this work. Preserve the original parent and its completed security evidence in #66. Reuse and rewrite open #67 for final hosted/legacy Cloudflare delivery and #70 for final certification. Existing Studio work in #68/#69 is delivered in #129/#130 to a substantial extent and is not a new implementation prerequisite; those legacy issues remain untouched pending their own checklist reconciliation. No issue is closed merely by writing this specification.

The inspected base is e9639e47c114802d61b3c669fbc1331ba2f6467b. The original checkout contains unrelated Stripe changes which must remain intact. Local design documents and the immutable documentation branch supplement this issue; the issue itself carries the complete implementable contract.

Supporting documentation: [cost assumptions and operational constraints](https://github.com/johanleroch/get-some-proof/blob/codex/cloudflare-delivery-spec/docs/cloudflare-delivery-costs.md) and [approved twelve-slice execution plan](https://github.com/johanleroch/get-some-proof/blob/codex/cloudflare-delivery-spec/docs/cloudflare-delivery-plan.md). The plan's final production execution slice is human-gated; the other slices are prepared for implementation agents with native blocking dependencies.

Primary references checked 2026-09-13: [KV](https://developers.cloudflare.com/kv/), [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/), [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/), [Static Assets](https://developers.cloudflare.com/workers/static-assets/), [R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/). Actual account configuration is not yet verified.
