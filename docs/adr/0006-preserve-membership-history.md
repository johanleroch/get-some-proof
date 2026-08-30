# Preserve inactive membership history

Removing a member deactivates the membership instead of deleting it, while revoking every role for that organization in the same transaction. This keeps authorization removal immediate, preserves an auditable relationship to historical actions, and allows a later reinvitation to be handled explicitly; inactive memberships never prove access.
