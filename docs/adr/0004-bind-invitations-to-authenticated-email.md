---
status: superseded by ADR-0012
---

# Bind invitations to the authenticated email

An invitation link is a route back into the signup or sign-in flow, not sufficient proof of identity by itself. Acceptance requires a valid authenticated user whose normalized email matches the invitation recipient; only then may the application atomically create the membership and initial role, preventing a forwarded or leaked link from granting access to another identity.
