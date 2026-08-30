# Scope organization routes explicitly

Organization pages live under `/org/<organization-slug>/...`, where the stable slug combines the creation-time name with a four-character lowercase alphanumeric suffix and a unique-index retry. The route makes organization context explicit and collision-free without treating the slug as an authorization secret; every request resolves it to the canonical organization, verifies membership, and uses the organization ID as the tenant boundary.
