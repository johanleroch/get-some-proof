# Google Business Profile connection

## Problem and decisions

A client wants to connect their Google My Business reviews. The Owner can connect
Google Business Profile to a Project, choose an account and verified location,
and read the original reviews privately with pagination. Google is a connected
source, not a permanent Testimonial Import. Reviews are fetched on demand and
never saved to the database, backups, Inbox, public Walls, or Widgets.

The Owner delegated routine product and testing decisions on 2026-09-12 via
ask-matt. The route is grill-with-docs → spec → implementation with TDD → review.
No prototype is needed. Test seams are the authenticated connection actions and
the visible connection view. Existing unrelated Stripe changes are excluded.

## Acceptance ledger

- [ ] Project Owner can authorize Google with single-use, expiring OAuth state and PKCE.
- [ ] Credentials are encrypted at rest and never returned to browser queries.
- [ ] Another Owner cannot read, connect, replace or disconnect this Project's connection.
- [ ] Accounts, locations and reviews paginate; original review wording is preserved.
- [ ] Provider errors, missing setup, denied consent and revoked grants are actionable.
- [ ] Disconnect removes local credentials and attempts Google revocation.
- [ ] Project deletion removes the connection.
- [ ] Local checks, remote CI and two targeted screenshots verified.
- [ ] Real approved Google project and owner-authorized verified location certified.
- [ ] Google confirms the basis for public review redistribution before public Wall support.

The last two criteria require external evidence and remain open; mock tests do
not certify them. No live connection or public redistribution is promised by this
implementation. Replies, profile edits, scraping, Places fallback, scheduled
sync and native testimonial conversion are out of scope.

## Source evidence (checked 2026-09-12)

- [Reviews list](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list): verified locations, 50 reviews per page, business.manage scope.
- [Prerequisites](https://developers.google.com/my-business/content/prereqs): approved Cloud project and qualifying verified business profile.
- [OAuth](https://developers.google.com/my-business/content/implement-oauth): owner authorization and offline access.
- [Policies](https://developers.google.com/my-business/content/policies): temporary secure cache only, maximum 30 days, unchanged content, easy disconnect. General purpose is managing/reporting listings. Public redistribution is not explicitly established here.
- [Basic setup](https://developers.google.com/my-business/content/basic-setup): no sandbox.

## Configuration

Use a dedicated web OAuth client for this integration, separate from Google sign-in.
In the selected **Convex deployment** configure `GOOGLE_BUSINESS_CLIENT_ID`,
`GOOGLE_BUSINESS_CLIENT_SECRET` (Google Cloud credentials),
`GOOGLE_BUSINESS_ENCRYPTION_KEY` (32 random bytes, base64; retain securely for
existing connections), and `GOOGLE_BUSINESS_REDIRECT_URI` (the Next.js origin plus
`/api/google-business/callback`). No browser-exposed secret or CI secret is needed.
Approve the Business Profile API project and enable Account Management, Business
Information and My Business APIs. Configure OAuth consent with business.manage.
Google authorization/verification and API approval are separate gates.

After deployment, test real consent, an owned verified location, review pagination,
revocation/reconnection and disconnect. Ask Google support about selected review
redistribution before implementing the public-wall follow-up.

## Implementation review

Standards: optional typed Convex environment declarations and the shared heading
utility were corrected. Spec: explicit reconnect and truthful retry labels,
server-side disconnect lock, scheduled abandoned-lock cleanup, and rejection of
in-flight authorization completion after disconnect. Tests cover the OAuth and
revocation races. Google account list pages use its documented maximum of 20;
locations and reviews use 50. Authenticated reads are limited per Owner.

Project deletion discards local credentials and schedules best-effort Google
revocation. Failed provider revocation is not claimed as successful; the Owner
can always remove permission in Google Account Connections. Revocation of a
Google grant may require reconnecting other Projects using the same Google account.

First full test run hit an unrelated five-second timeout in Account pagination
while other tools were running. That file passed in isolation, then the full
suite passed (1,134 tests) on the next run. No Account code was changed.
