# Require a verified email for organization access

A user may authenticate before completing email verification, but cannot create an organization, accept an invitation, or receive an active membership until the address attached to the authenticated identity is verified. Email-and-password accounts use Better Auth verification, while supported social providers contribute their verified-email status; this keeps unverified identities outside every tenant boundary without coupling organization access to one sign-in method.
