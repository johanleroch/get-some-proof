# Keep one multi-tenant core

Every deployment uses the same multi-tenant organization, membership, and authorization model. A deployment serving only one organization may hide organization selection and onboarding in its interface, but it does not use a separate data or security architecture; this avoids two authorization paths while keeping the starter convenient for single-organization products.
