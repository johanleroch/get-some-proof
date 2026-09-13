---
status: accepted
---

# Deliver public proof independently through Cloudflare

Authoritative specification: [GitHub issue #168](https://github.com/johanleroch/get-some-proof/issues/168). The [execution plan](../cloudflare-delivery-plan.md) links the twelve approved slices; [cost research](../cloudflare-delivery-costs.md) records current assumptions and their limits.

The Owner chose Cloudflare delivery to separate visitor traffic from application computation and reduce media egress exposure. Next.js retains private management and collection; hosted and injected Public Walls and Widgets use a Cloudflare Worker serving complete, public-safe JSON publications from Workers KV. Workers Static Assets serves the versioned runtime and bundled catalogue fonts; R2 stores images, materialized video thumbnails and uploaded fonts. Convex remains the authoritative source and prepares publications. Mux retains video processing and playback.

Alternatives considered: R2 JSON objects could serve prepared configurations, but KV is the selected read-oriented publication store; Redis adds a separate service and is unnecessary for the accepted consistency. Putting every JS/CSS asset behind an R2-serving Worker adds work where direct Static Assets delivery suffices. Durable Objects may coordinate publication writes or protection if proven necessary, but do not replace KV as the visitor publication store. A CDN backed by live Next.js/Convex reads cannot satisfy the required independence.

Visitor requests never call Next.js or Convex, regenerate missing publications or fall back to the application. Choosing KV instead of a live backend lookup accepts eventual propagation, including delays of 60 seconds or more. Publication changes and removals reach subsequent reads after propagation; already-open pages keep their rendered content until explicit reload, with no polling or automatic clearing. A new request can accept a publication only within 24 hours of a successful authoritative renewal. This trades immediate global freshness for resilient read delivery; it does not authorize indefinite retention or change the 24-hour permanent-erasure requirement.

An Owner must declare embedding sites per Project before a new external installation. Explicit localhost origins and ports support pre-production tests. Production sites, www and staging are declared explicitly, without DNS verification in this version. The allowlist controls ordinary browser embedding, not request authenticity or DDoS. Cloudflare enforces it independently of the application; hosted public navigation has separate rules.

All product images and uploaded fonts move through the existing validated media lifecycle to R2. Private media remains private; public direct access is revoked after archive/withdrawal with the accepted propagation, while the Owner retains private access to archived material. Use separate environment resources, Project-first stable asset/variant/hash keys (Account-first for Account-owned photos), technical metadata and the authoritative application registry. Preserve normalized WebP, font licence constraints and the prohibition on sharing private blobs across Projects.

Preserve existing installed snippets and current public behavior through a staged compatibility migration. Compatible runtime updates are automatic through retained immutable releases. Keep original Convex media for seven days after a validated cutover to support rollback; withdrawal or deletion overrides that window and cleans both providers. Runtime rollback must retain Cloudflare delivery and support post-cutover R2-only media.

The initial budget is EUR 10–20 per month for Cloudflare only, including Workers, KV, R2 and security options. Costs for Convex, Vercel and Mux are separate. Progressive admission and targeted suspension/recovery are accepted, but measured workload/renewal/media costs and available plan capabilities must establish feasibility. Neither the allowlist nor R2/KV implies a guaranteed spending ceiling.

This decision amends ADR 0013's runtime/thumbnail allocation, supersedes ADR 0026's public freshness policy and ADR 0038's visitor-time public-proof resolution, and updates ADR 0039's storage allocation while preserving its normalization and ownership rules. The approved specification defines the publication, media, access, failure and migration contracts. Acceptance records a design choice, not completed implementation or deployment. GitHub is the authoritative specification and execution tracker.
