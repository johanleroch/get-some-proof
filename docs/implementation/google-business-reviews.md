# Google Business Profile connection

Connector architecture and the next-provider procedure are described in
[Connected review providers](review-connectors.md).

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
polling and native testimonial conversion are out of scope.

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
suite passed (1,135 tests, including the added race regression) on the next run. No Account code was changed.

## Existing browser failures repaired during delivery

The full browser gate exposed failures reproduced at the original base commit
`7346604`. The standalone MCP import widget bundled Next.js environment reads
without a browser `process` object; its build now substitutes an empty environment
and the production NODE_ENV literal, never host secrets. Studio selection keeps
its checkbox accessible name and explicitly restores focus to its opener.

Browser tests now follow the current unified Inbox Actions menu, assistant
connection copy, shared embed-code block, and Studio application shell. Layout
tests retain overflow, scrolling, and available-width checks. Crop export tests
accept the browser's PNG fallback while still asserting transparent pixel data.
Standards and Spec review requested stronger layout assertions; both were applied.

## Automatic review notifications (2026-09-13)

The Owner explicitly requested Pub/Sub updates and accepted replacement of another
tool's Google notification destination when the user is warned first. The
activation dialog explains the account-wide effect and changes no Google reviews.
The backend requires the replacement acknowledgement before its PATCH. Automatic
updates are enabled for one selected location per Project. Enabling another
location changes that Project's selection. Reconnecting Google requires enabling
updates again, so a different Google identity never inherits the subscription.

Google publishes NEW_REVIEW and UPDATED_REVIEW to the application's Cloud Pub/Sub
topic. An authenticated push subscription calls the Convex HTTP endpoint
`/google-business/pubsub`. Verify the Google signature, expiry, issuer, exact
audience, verified service-account email and expected subscription before accepting
routing metadata. Duplicates are ignored for seven days; bounded scheduled batches
notify matching active connections. Failed database writes are not acknowledged,
so Pub/Sub retries. No review text, stars or reviewer identity is persisted.

An open review list observes a reactive revision, coalesces event bursts and loads
the current Google reviews again, starting at the first page. Reopening a Project
with updates enabled loads its saved location. Turning updates off or disconnecting
stops delivery to this Project. Turning off does not clear the Google account's
shared topic because other Projects can still use it. Notifications for locations
without an active listener are acknowledged without persisting metadata. This is
not an offline archive or public testimonial import.

### Additional deployment configuration

All four values belong to the selected Convex deployment and are non-secret:

- `GOOGLE_BUSINESS_PUBSUB_TOPIC`: full topic resource in the approved Google Cloud project.
- `GOOGLE_BUSINESS_PUBSUB_SUBSCRIPTION`: full authenticated push subscription resource.
- `GOOGLE_BUSINESS_PUBSUB_AUDIENCE`: the exact HTTPS Convex push endpoint URL.
- `GOOGLE_BUSINESS_PUBSUB_SERVICE_ACCOUNT_EMAIL`: dedicated push identity; verify email_verified.

Enable the My Business Notifications API and Cloud Pub/Sub API. Grant
`mybusiness-api-pubsub@system.gserviceaccount.com` Pub/Sub Publisher on the topic.
Configure the subscription with the dedicated push identity and exact audience;
grant the Pub/Sub service agent permission to mint its ID tokens. Configure a
dead-letter topic and a bounded retry policy for poison messages. Initial Business
Profile approval/OAuth credentials and a real signed Google notification are still
external certification requirements; local signing tests are not provider approval.

Sources checked 2026-09-13:

- [Google notification setup](https://developers.google.com/my-business/content/notification-setup)
- [Account-wide notification setting](https://developers.google.com/my-business/reference/notifications/rest/v1/NotificationSetting)
- [Pub/Sub push authentication](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions)
- [Pub/Sub HTTP delivery and acknowledgements](https://docs.cloud.google.com/pubsub/docs/push)
