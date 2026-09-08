# Account and Projects validation

Specification: #83. Implementation tickets: #84–#88.

## Local verification

On 2026-09-08, the implementation worktree passed `pnpm check`: formatting,
ESLint, TypeScript, 635 tests across 113 files, and the production build.
`PLAYWRIGHT_PORT=3100 pnpm test:e2e` passed all 310 browser tests.
The first combined run exceeded the five-second limit in two tests while the
browser suite ran concurrently. The complete check passed when run alone,
without changing test timeouts or assertions.

These results cover the working diff, not a published commit. Remote CI and
current-commit screenshot publication remain pending.

## Acceptance evidence

| Ticket | Behavior                                                                                             | Evidence                                                                                                                                                                                            |
| ------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #84    | Owner-derived Account plan, billing identity and shared usage                                        | `tests/accounts.test.ts`, existing billing entitlement/action/webhook tests, and Account-aware billing queries                                                                                      |
| #84    | Owner and plan above navigation, Project selector below; English upgrade and management actions      | `e2e/account-projects.spec.ts`, AppShell and dashboard component tests; local synthetic Free and Pro browser sessions                                                                               |
| #85    | One Free Project, unlimited isolated Pro Projects, pagination beyond the initial navigation snapshot | `tests/accounts.test.ts` exercises concurrent Free creation, Pro creation and 102 Projects across cursor pages                                                                                      |
| #85    | Shared reservations and credits, including concurrent capacity admission                             | `tests/accounts.test.ts` exercises 26 concurrent reservations against 25 shared slots and continued text availability; `tests/collection-quotas.test.ts` covers accounting and retries              |
| #85    | Switching retains Account plan and selects the correct Project destinations                          | `e2e/account-projects.spec.ts` verifies the selected heading, shared usage and collection link across desktop and mobile browsers                                                                   |
| #86    | Selected or fallback Free Project, private inactive Projects and revoked public surfaces             | `tests/accounts.test.ts`, `tests/billing-downgrade.test.ts`, public projection/wall tests and the inactive Project browser fixture                                                                  |
| #86    | Video selection, 30-day retention, warnings, bounded jobs and recovery races                         | `tests/billing-downgrade.test.ts` covers older preserved keepers, delayed uploads, missed provider webhooks, D-7/D-1 delivery, retry, deleted billing anchor and recovery before or between batches |
| #86    | Recovery does not automatically republish proof                                                      | Regression tests cover both queued downgrade work and cancellation expiry before the worker runs                                                                                                    |
| #87    | Project deletion preserves Account billing and lifetime credits, including the final Project         | `tests/accounts.test.ts` and `tests/workspace-deletion.test.ts`; deletion component tests cover confirmation and ongoing billing copy                                                               |
| #88    | Recent authentication and explicit whole-Account confirmation                                        | `tests/account-deletion.test.ts`, account closure component tests and destructive confirmation browser coverage                                                                                     |
| #88    | Immediate revocation, retryable cancellation and cleanup, late-event rejection                       | `tests/account-deletion.test.ts` and submission management tests cover the interval before Project cleanup, retry and other-owner isolation                                                         |
| All UI | Billing can scroll to its final controls while navigation remains available                          | Five browser configurations pass the dedicated Billing scrolling regression                                                                                                                         |

## Verification boundaries

Backend provider behavior is tested with service mocks and the local fake Mux
adapter. The interactive Free/Pro check uses a synthetic local Account and a
synthetic verified subscription event. It does not prove a real Stripe checkout,
real payment, production deployment or real Mux deletion. No production reset,
merge or deployment is part of this validation.

## Delivery still required

Standards and Spec reviews examined the implementation against base
`df7e964e04b7dd5ad1caeb7756e344ff45490ae0`. Their correctness findings were
resolved: unchanged Convex pagination options, retained older eligible videos,
immediate management-link revocation during Account closure, late-upload
retention, cancellation-expiry publication revocation, and retryable provider
upload cleanup when an asset webhook is missed. Both reviewers reported no
remaining actionable findings in the reviewed fixes. The final fixture-only
hydration marker also passes the complete local checks and browser suite.

- Record the reviewed commit and review resolutions.
- Capture and inspect the canonical desktop/mobile images at that commit.
- Push the branch, create the PR and observe every required remote check.
- Publish and verify current-head GitHub screenshot attachments.
- Synchronize the issue and PR checklists with those final results.
