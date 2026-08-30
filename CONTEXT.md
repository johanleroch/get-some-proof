# Convex Admin Starter

An opinionated, cloneable foundation for building secure multi-tenant administration products with Convex. A template adopter extends its code into a product or SaaS, while operators use the resulting interface to run their organization.

## Language

**Template Adopter**:
A person or team that clones and extends the starter to build and deploy its own product or SaaS.
_Avoid_: End User, Operator, Customer

**Operator**:
A person who uses the resulting administration product to run an organization, often without working on its code.
_Avoid_: Template Adopter, Developer

**User**:
An authenticated person whose identity can participate in one or more organizations.
_Avoid_: Account, Member when referring to identity

**Organization**:
A customer space whose members and resources share one business and access boundary.
_Avoid_: Workspace, Account, Tenant in product language

**Organization Slug**:
A stable URL identifier derived from an organization name and completed by four random lowercase alphanumeric characters for uniqueness; changing the organization name does not change it.
_Avoid_: Organization ID, Tenant ID

**Tenant**:
The technical data and authorization partition corresponding to an organization.
_Avoid_: Workspace, Customer account

**Membership**:
A recorded relationship between a user and an organization; only an active membership proves current participation, while inactive memberships preserve history without access.
_Avoid_: Access, Role

**Member**:
A user participating in an organization through an active membership.
_Avoid_: User when referring specifically to organization participation

**Invitation**:
A time-limited, single-use offer addressed to an email recipient to create a membership in an organization with an intended initial role.
_Avoid_: Membership, Email

**Project**:
The removable example resource used to demonstrate organization-scoped listing, creation, editing, archiving, and authorization.
_Avoid_: Organization, Tenant

**Audit Event**:
An immutable, organization-scoped record of an actor performing a security-sensitive or administratively significant operation.
_Avoid_: Activity, Log Entry

## Organization Roles

**Viewer**:
A member who can read organization resources and see the member directory without changing either.
_Avoid_: Read-only User, Guest

**Editor**:
A member who can create, modify, and archive organization resources but cannot permanently delete them or administer members.
_Avoid_: Contributor, Author

**Admin**:
A member who can administer non-owner members and organization operations, including permanent resource deletion, without controlling ownership.
_Avoid_: Administrator, Manager

**Owner**:
An admin with authority over organization ownership and owner-only governance; every organization must retain at least one.
_Avoid_: Super Admin, Primary Admin
