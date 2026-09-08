# Multi-project design discussion

## Confirmed

- One Account owns the plan and shared quotas for its Projects.
- Free includes one Project. Pro includes unlimited Projects without a per-Project surcharge; all Projects share the Account's existing plan quotas.
- Each Project has separate branding, testimonials, settings, and public destinations.
- Owner-only management in the initial release.
- Product interface copy is English.
- Sidebar top: user name, email, current plan, and `Upgrade to Pro` on Free or `Manage subscription` on Pro.
- Sidebar bottom: Project selector.
- Authenticated home: current plan and Account-wide usage, explicitly shared across Projects.
- On downgrade to Free, the Owner selects one active Project. Other Projects remain viewable in the dashboard with collection and public pages disabled; text is retained and video follows the downgrade retention policy.
- Projects draw from one shared video allowance without fixed per-Project allocations. In-flight uploads still reserve capacity against the Account allowance. When full, new video collection stops across the Account; Pro text collection remains available.
- Deleting a Project removes only its contents and does not cancel the Account subscription, even for the last Project. Show an explicit billing warning and `Manage subscription` link.
- Project deletion frees stored-video capacity but does not reset consumed lifetime Free credits.
- If no active Project is selected before downgrade, the oldest remaining Project stays active; this fallback is disclosed before the plan ends.
- On downgrade, retain up to two Owner-selected videos in the active Project, defaulting to the latest published eligible videos without a selection. All other videos, including those in inactive Projects, enter 30-day retention before permanent source deletion, with advance warnings and no Owner MP4 download feature.
- Returning to Pro before retention expiry cancels the scheduled downgrade deletion and allows Project reactivation without automatically republishing Testimonials.
- Existing records are test data created by the Owner and their associate; preserving backward compatibility through a user-data migration is not a delivery requirement. No data reset has been executed by this design discussion.
- `Create project` creates an empty Project with its own name, logo, and public slug, using the existing collection-form and public-wall behavior. On Free, creating another Project presents `Upgrade to Pro`.
- `Delete account` removes all of the Account's Projects and cancels its subscription, with an explicit confirmation of the full scope. `Delete project` remains a separate action.

## Status

The Owner confirmed the full design, testing approach, five-ticket breakdown and dependencies, and authorized publication of the specification and tickets on GitHub. Implementation is in progress on `codex/account-projects` in the isolated `get-some-proof-account-projects` worktree. Delivery remains unverified until review, visual evidence and remote CI are complete.

- Specification: https://github.com/johanleroch/get-some-proof/issues/83
- Account billing and visible plan: https://github.com/johanleroch/get-some-proof/issues/84
- Unlimited Pro Projects sharing quotas: https://github.com/johanleroch/get-some-proof/issues/85 (blocked by #84)
- Downgrade and recovery: https://github.com/johanleroch/get-some-proof/issues/86 (blocked by #85)
- Project deletion: https://github.com/johanleroch/get-some-proof/issues/87 (blocked by #85)
- Account deletion: https://github.com/johanleroch/get-some-proof/issues/88 (blocked by #87)

## Competitor references checked 2026-09-08

- Senja: Free and Starter include one Project; Pro includes five with additional Projects at USD 10/month each. https://support.senja.io/how-do-i-add-or-create-a-new-project-28iki
- Testimonial.to: Free and Starter allow one Space; current Ultimate and Ultimate+ bill each Space separately. https://help.testimonial.to/en/articles/16528365-how-extra-spaces-are-billed

These are design notes, not implementation or delivery evidence.
