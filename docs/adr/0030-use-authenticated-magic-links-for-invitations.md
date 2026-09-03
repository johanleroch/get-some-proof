# Use authenticated magic links for invitations

Organization invitations use a one-time Better Auth magic link whose callback carries the separate application Invitation token. Clicking the emailed link creates or authenticates a User with a verified matching address before the Invitation is atomically accepted, avoiding a redundant signup and verification email while preserving token rotation, expiry, email matching, and Membership authorization checks.
