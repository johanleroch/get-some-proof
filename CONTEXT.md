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

**Profile Image**:
A square image uploaded and cropped by a user, rendered as a circle across their authenticated identity surfaces. The stored file belongs to that user and is replaced or removed only by them.
_Avoid_: Avatar URL, Member Image

**Organization**:
A customer space whose members and resources share one business and access boundary.
_Avoid_: Workspace, Account, Tenant in product language

**Platform Stripe Account**:
The single Stripe merchant account owned by the company operating the deployed SaaS; it receives subscription payments from Organizations and is never an Organization-owned connected account.
_Avoid_: Organization Stripe Account, Connected Account

**Organization Subscription**:
The single fixed-price billing relationship through which an Organization pays the deployed SaaS for its plan, independently of its member count and of the individual Owner who completes checkout on its behalf.
_Avoid_: User Subscription, Membership

**Billing Contact**:
The Organization-level email recipient for Stripe billing communication and invoices. It initially uses the verified email of the subscribing Owner but remains independent of that User afterward.
_Avoid_: Owner Email, Organization Identity

**Free Plan**:
The default non-paid Organization plan, with a deliberately limited product entitlement and no Stripe subscription.
_Avoid_: Trial, Canceled Subscription

**Premium Plan**:
The paid Organization plan backed by a subscription on the Platform Stripe Account.
_Avoid_: Membership Tier, User Plan

**Premium Entitlement**:
The server-derived permission for an Organization to use paid product behavior. Active, trialing, and temporarily past-due subscriptions grant it; unpaid, canceled, and expired incomplete subscriptions do not.
_Avoid_: Client Flag, Checkout Success, Role

**Organization Slug**:
A stable URL identifier derived from an organization name and completed by four random lowercase alphanumeric characters for uniqueness; changing the organization name does not change it.
_Avoid_: Organization ID, Tenant ID

**Organization Logo**:
An optional square image shared across an organization. Owners and admins may upload, replace, or remove it; other members can only view it.
_Avoid_: Profile Image, Workspace Icon

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
