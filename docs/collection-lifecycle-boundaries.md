# Collection admission and lifecycle boundaries

These rules describe repository behavior. Deployment and provider state require separate verification.

## Initial image uploads

An initial image or avatar upload requires a server-issued Collection admission. The public issuer verifies the existing Turnstile challenge before creating that admission. An admission is a random bearer value whose hash is stored in Convex. It belongs to one Brand and browser submission, expires after ten minutes, permits three image allocations and three avatar allocations, and permits one final text submission or initial video reservation. Allocation counters and final consumption change transactionally. After final consumption, further allocations are refused.

The browser uses the admission for attachments and final submission, so it does not replay a single-use Turnstile token. The no-attachment path retains its existing direct verification. Retrying a failed flow resets verification. Existing image MIME, size, ownership, upload-attempt, per-Brand and storage-expiry rules still apply. Management-link holders use their existing verified, unexpired link and matching Brand instead; the link is checked on every allocation.

Issuance is bounded by the rate-limiter component: 1,000 admissions globally per hour, 100 per Brand, and three per browser submission. These budgets are consumed only after verification. Admission rows expire through scheduled cleanup and are included in Workspace deletion. No new deployment secret is required: existing Turnstile server configuration applies.

## Video cleanup

Cancelling or expiring an upload persists provider cleanup in the same transaction as releasing its reservation. Ready videos that were never submitted also expire. Submitted Ready videos retain their normal lifecycle. Retry cancellations preserve provider targets before detaching local records, and failed provider attachment keeps its trusted organization correlation across the asynchronous boundary.

Cleanup jobs are idempotent by provider target and retried after provider failure. Late events can add a newly reported asset target without replacing a job already being processed. Recording cleanup on an asset prevents re-enqueuing its original target during browser retry. Outstanding jobs conservatively count against video capacity until provider cleanup succeeds; one resource can temporarily have both an upload and an asset cleanup target. Expired reservations remain counted until their scheduled lifecycle transition, so a delayed scheduler does not grant capacity early.

## Management-link recovery

Well-formed recovery requests pass a global admission budget of 1,000 per hour before target-specific work. Invalid input, missing Brands, deleting Brands and addresses without matching testimonials do not create target buckets, replacement requests or delivery jobs. Expired target buckets are purged in bounded batches. An indexed existence probe precedes target admission; full matching history is loaded only after active-request and target/Brand checks. Existing grouped delivery, outbox leases and atomic rotation only after successful delivery remain in place. This existing grouped hydration is not paginated and remains subject to Convex transaction-size limits for unusually large histories; this change bounds admission, not every admitted request’s work. Public responses retain the same accepted shape; this does not promise identical network timing.

## Invitations during deletion

Creating, resending, changing the role of, or accepting an Invitation checks the Brand deletion barrier in its transaction. The delivery lookup also checks that barrier. A send already accepted by the external provider cannot be recalled, but its Invitation cannot activate membership after deletion starts.

## Verification seams

Behavioral regressions cover public allocation and acceptance calls, provider-boundary cleanup, late events, concurrent image admission, expiry, recovery admission and the rendered collection orchestration. The public Wall has a separate [server boundary](public-wall-boundary.md). Provider calls in tests use synthetic fixtures; local success is not evidence that a deployed environment has changed.
