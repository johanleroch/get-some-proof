# 8. Limit abusive public traffic with targeted suspension and a cost ledger

## Parent

#168 — Independent Cloudflare delivery for Walls, Widgets and product media. This ticket implements stories 12, 32, 33, 34. The full parent contract and accepted delivery decisions apply.

## What to build

An abnormal traffic burst is limited or suspends only its affected Project/Widget, while unrelated proof and private operations stay usable and the operator sees actionable cost evidence.

## Acceptance criteria

- [ ] Implement request validation and progressive admission using capabilities actually verified on the current Cloudflare plans. Treat Workers Paid and zone WAF subscriptions separately.
- [ ] Bound malformed paths, unsupported query variants, unknown IDs, distinct valid IDs, media requests, payloads and retries. Perform early rejection before unnecessary KV/R2 reads where possible; do not turn negative caching into attacker-controlled growth.
- [ ] Make targeted suspension and controlled recovery function from Cloudflare state during a control-plane outage, with privacy-safe notifications/status. An asynchronous log callback alone is not real-time enforcement.
- [ ] Preserve dashboard/collection and unrelated Projects. Cover shared-IP legitimate visitors, multiple Widgets and a forged Origin so the allowlist is never presented as DDoS authentication.
- [ ] Produce verifiable request/CPU, KV read/write, renewal, media-authorization, R2 cache-miss/storage and rejection metrics; use aggregate operational data without introducing visitor tracking.
- [ ] Price the entire initial Cloudflare topology including staging and any security subscription against EUR 10–20 monthly. Show workload envelope and thresholds; no silent paid upgrade, privacy downgrade or claim of a hard billing cap.
- [ ] Run bounded isolated synthetic traffic, outage and recovery scenarios and record counters/cost estimates. No attack/load test against production. Pass gates and only relevant operational UI evidence.

## Blocked by

- #170
- #171
- #172

## Implementation workflow

Use /implement with /tdd at the agreed publication/delivery, media lifecycle and browser seams, then /code-review on both Standards and Spec. Consult current Context7/provider docs and repository Convex/Next.js guidance when applicable. Use the relevant Cloudflare, Convex, React and visual-evidence skills; publish current-head screenshots through gh-image for visible changes. Record real local/remote gates and keep unproven checkboxes open. Preserve unrelated work in an isolated codex worktree. This issue does not authorize merging, new paid services or production changes; the separate execution gate carries production approval and elapsed-retention requirements.
