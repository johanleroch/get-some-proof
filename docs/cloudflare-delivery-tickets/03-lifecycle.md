# 3. Keep published proof current with durable synchronization and 24-hour validity

## Parent

#168 — Independent Cloudflare delivery for Walls, Widgets and product media. This ticket implements stories 4, 5, 6, 7, 8, 9, 10, 11. The full parent contract and accepted delivery decisions apply.

## What to build

Publishing or changing proof updates every dependent public copy safely, and already-published proof survives an ordinary control-plane outage for up to its explicit validity without visitor backend calls.

## Acceptance criteria

- [ ] Generate full Widget and bounded Public Wall publications from current public-safe source state, preserving existing selections, order, pagination and eligibility. Maintain dependency lookup for every published reference.
- [ ] Cover moderation, revision/withdrawal/deletion, visibility, Brand identity, image/highlight/font changes, subscription/grace/downgrade/Free-Project selection, Project/Account deletion and asynchronous video updates.
- [ ] Implement durable per-surface ordered publishing with coalescing, retries, tombstones and recovery after crashes/unknown-result writes. Prove duplicate and delayed workers cannot make an older revision the lasting active state; do not assume KV compare-and-set or immediate cross-location visibility.
- [ ] Prepare complete revisions before activation; bind pagination to one bounded revision and reject unsupported parameters/expired continuations without arbitrary KV reads.
- [ ] Set and enforce absolute validity of at most 24 hours since authoritative renewal. Schedule bounded renewal of eligible publications independent of visits with headroom before expiry; account for the write workload. Never extend an invalid/withdrawn snapshot by merely refreshing its timestamp.
- [ ] Expose publication pending/failed status and safe retry in the Owner workflow. Ordinary errors retain only the last valid publication; withdrawal/deletion is priority work and cancels competing renewals.
- [ ] Remove public runtime polling, automatic refresh and the existing 60-second clearing timer. Already-rendered content remains until explicit reload; new requests reject expired delivery state.
- [ ] Use controlled-clock tests for every lifecycle family, stale KV reads, partitioned pagination, outage/renewal, unknown-result publishing, deletion races and no timed browser requests. Pass relevant gates and targeted UI evidence.

## Blocked by

- #169

## Implementation workflow

Use /implement with /tdd at the agreed publication/delivery, media lifecycle and browser seams, then /code-review on both Standards and Spec. Consult current Context7/provider docs and repository Convex/Next.js guidance when applicable. Use the relevant Cloudflare, Convex, React and visual-evidence skills; publish current-head screenshots through gh-image for visible changes. Record real local/remote gates and keep unproven checkboxes open. Preserve unrelated work in an isolated codex worktree. This issue does not authorize merging, new paid services or production changes; the separate execution gate carries production approval and elapsed-retention requirements.
