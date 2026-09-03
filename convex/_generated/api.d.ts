/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auditEvents from "../auditEvents.js";
import type * as auth from "../auth.js";
import type * as authorization from "../authorization.js";
import type * as billing from "../billing.js";
import type * as billingActions from "../billingActions.js";
import type * as billingEntitlements from "../billingEntitlements.js";
import type * as billingService from "../billingService.js";
import type * as dashboard from "../dashboard.js";
import type * as domain_brand from "../domain/brand.js";
import type * as domain_invitation from "../domain/invitation.js";
import type * as domain_organizationSlug from "../domain/organizationSlug.js";
import type * as domain_profileImage from "../domain/profileImage.js";
import type * as domain_submission from "../domain/submission.js";
import type * as email_provider from "../email/provider.js";
import type * as email_templates from "../email/templates.js";
import type * as http from "../http.js";
import type * as invitationRecords from "../invitationRecords.js";
import type * as invitations from "../invitations.js";
import type * as members from "../members.js";
import type * as organizationAuthorization from "../organizationAuthorization.js";
import type * as organizations from "../organizations.js";
import type * as profileImages from "../profileImages.js";
import type * as projects from "../projects.js";
import type * as publicWall from "../publicWall.js";
import type * as security_organizationAccess from "../security/organizationAccess.js";
import type * as security_principal from "../security/principal.js";
import type * as seed from "../seed.js";
import type * as stripeBillingProvider from "../stripeBillingProvider.js";
import type * as submissions from "../submissions.js";
import type * as system from "../system.js";
import type * as testimonialModeration from "../testimonialModeration.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auditEvents: typeof auditEvents;
  auth: typeof auth;
  authorization: typeof authorization;
  billing: typeof billing;
  billingActions: typeof billingActions;
  billingEntitlements: typeof billingEntitlements;
  billingService: typeof billingService;
  dashboard: typeof dashboard;
  "domain/brand": typeof domain_brand;
  "domain/invitation": typeof domain_invitation;
  "domain/organizationSlug": typeof domain_organizationSlug;
  "domain/profileImage": typeof domain_profileImage;
  "domain/submission": typeof domain_submission;
  "email/provider": typeof email_provider;
  "email/templates": typeof email_templates;
  http: typeof http;
  invitationRecords: typeof invitationRecords;
  invitations: typeof invitations;
  members: typeof members;
  organizationAuthorization: typeof organizationAuthorization;
  organizations: typeof organizations;
  profileImages: typeof profileImages;
  projects: typeof projects;
  publicWall: typeof publicWall;
  "security/organizationAccess": typeof security_organizationAccess;
  "security/principal": typeof security_principal;
  seed: typeof seed;
  stripeBillingProvider: typeof stripeBillingProvider;
  submissions: typeof submissions;
  system: typeof system;
  testimonialModeration: typeof testimonialModeration;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  authz: import("@djpanda/convex-authz/_generated/component.js").ComponentApi<"authz">;
  stripe: import("@convex-dev/stripe/_generated/component.js").ComponentApi<"stripe">;
};
