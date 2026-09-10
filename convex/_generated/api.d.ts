/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountDeletion from "../accountDeletion.js";
import type * as accounts from "../accounts.js";
import type * as anonymousWallImports from "../anonymousWallImports.js";
import type * as assistantImportMedia from "../assistantImportMedia.js";
import type * as assistantImports from "../assistantImports.js";
import type * as assistantUploads from "../assistantUploads.js";
import type * as auditEvents from "../auditEvents.js";
import type * as auth from "../auth.js";
import type * as authorization from "../authorization.js";
import type * as billing from "../billing.js";
import type * as billingActions from "../billingActions.js";
import type * as billingDowngrade from "../billingDowngrade.js";
import type * as billingDowngradeEmail from "../billingDowngradeEmail.js";
import type * as billingDowngradeVideo from "../billingDowngradeVideo.js";
import type * as billingEntitlements from "../billingEntitlements.js";
import type * as billingInvoices from "../billingInvoices.js";
import type * as billingMigrationQueries from "../billingMigrationQueries.js";
import type * as billingMigrations from "../billingMigrations.js";
import type * as billingService from "../billingService.js";
import type * as collectionAdmission from "../collectionAdmission.js";
import type * as collectionQuotas from "../collectionQuotas.js";
import type * as collectionRateLimit from "../collectionRateLimit.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as domain_brand from "../domain/brand.js";
import type * as domain_colorContrast from "../domain/colorContrast.js";
import type * as domain_importAccessToken from "../domain/importAccessToken.js";
import type * as domain_invitation from "../domain/invitation.js";
import type * as domain_muxWebhook from "../domain/muxWebhook.js";
import type * as domain_organizationSlug from "../domain/organizationSlug.js";
import type * as domain_profileImage from "../domain/profileImage.js";
import type * as domain_submission from "../domain/submission.js";
import type * as domain_testimonialImage from "../domain/testimonialImage.js";
import type * as domain_testimonialImport from "../domain/testimonialImport.js";
import type * as domain_testimonialRichText from "../domain/testimonialRichText.js";
import type * as domain_video from "../domain/video.js";
import type * as email_provider from "../email/provider.js";
import type * as email_templates from "../email/templates.js";
import type * as http from "../http.js";
import type * as importAcquisition from "../importAcquisition.js";
import type * as importAvatarUpload from "../importAvatarUpload.js";
import type * as importEligibility from "../importEligibility.js";
import type * as importOAuth from "../importOAuth.js";
import type * as importOAuthCommands from "../importOAuthCommands.js";
import type * as importOAuthOptions from "../importOAuthOptions.js";
import type * as invitationRecords from "../invitationRecords.js";
import type * as invitations from "../invitations.js";
import type * as members from "../members.js";
import type * as migrations from "../migrations.js";
import type * as muxWebhook from "../muxWebhook.js";
import type * as organizationAuthorization from "../organizationAuthorization.js";
import type * as organizations from "../organizations.js";
import type * as profileImages from "../profileImages.js";
import type * as projectActivity from "../projectActivity.js";
import type * as projects from "../projects.js";
import type * as publicProjection from "../publicProjection.js";
import type * as publicReadRateLimit from "../publicReadRateLimit.js";
import type * as publicWall from "../publicWall.js";
import type * as security_organizationAccess from "../security/organizationAccess.js";
import type * as security_principal from "../security/principal.js";
import type * as security_publicWallAccess from "../security/publicWallAccess.js";
import type * as seed from "../seed.js";
import type * as storageCleanup from "../storageCleanup.js";
import type * as stripeBillingProvider from "../stripeBillingProvider.js";
import type * as stripeConfiguration from "../stripeConfiguration.js";
import type * as stripeWebhookReconciliation from "../stripeWebhookReconciliation.js";
import type * as stripeWebhookSync from "../stripeWebhookSync.js";
import type * as submissionManagement from "../submissionManagement.js";
import type * as submissions from "../submissions.js";
import type * as system from "../system.js";
import type * as testimonialCardValue from "../testimonialCardValue.js";
import type * as testimonialDeletion from "../testimonialDeletion.js";
import type * as testimonialImages from "../testimonialImages.js";
import type * as testimonialImportAvatar from "../testimonialImportAvatar.js";
import type * as testimonialImportSource from "../testimonialImportSource.js";
import type * as testimonialImportVideo from "../testimonialImportVideo.js";
import type * as testimonialImports from "../testimonialImports.js";
import type * as testimonialModeration from "../testimonialModeration.js";
import type * as turnstile from "../turnstile.js";
import type * as video from "../video.js";
import type * as videoImportCleanup from "../videoImportCleanup.js";
import type * as videoMedia from "../videoMedia.js";
import type * as videoProvider from "../videoProvider.js";
import type * as videoRetryDelivery from "../videoRetryDelivery.js";
import type * as videoRetryLinks from "../videoRetryLinks.js";
import type * as videoWebhooks from "../videoWebhooks.js";
import type * as wallCustomization from "../wallCustomization.js";
import type * as workspaceDeletion from "../workspaceDeletion.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountDeletion: typeof accountDeletion;
  accounts: typeof accounts;
  anonymousWallImports: typeof anonymousWallImports;
  assistantImportMedia: typeof assistantImportMedia;
  assistantImports: typeof assistantImports;
  assistantUploads: typeof assistantUploads;
  auditEvents: typeof auditEvents;
  auth: typeof auth;
  authorization: typeof authorization;
  billing: typeof billing;
  billingActions: typeof billingActions;
  billingDowngrade: typeof billingDowngrade;
  billingDowngradeEmail: typeof billingDowngradeEmail;
  billingDowngradeVideo: typeof billingDowngradeVideo;
  billingEntitlements: typeof billingEntitlements;
  billingInvoices: typeof billingInvoices;
  billingMigrationQueries: typeof billingMigrationQueries;
  billingMigrations: typeof billingMigrations;
  billingService: typeof billingService;
  collectionAdmission: typeof collectionAdmission;
  collectionQuotas: typeof collectionQuotas;
  collectionRateLimit: typeof collectionRateLimit;
  crons: typeof crons;
  dashboard: typeof dashboard;
  "domain/brand": typeof domain_brand;
  "domain/colorContrast": typeof domain_colorContrast;
  "domain/importAccessToken": typeof domain_importAccessToken;
  "domain/invitation": typeof domain_invitation;
  "domain/muxWebhook": typeof domain_muxWebhook;
  "domain/organizationSlug": typeof domain_organizationSlug;
  "domain/profileImage": typeof domain_profileImage;
  "domain/submission": typeof domain_submission;
  "domain/testimonialImage": typeof domain_testimonialImage;
  "domain/testimonialImport": typeof domain_testimonialImport;
  "domain/testimonialRichText": typeof domain_testimonialRichText;
  "domain/video": typeof domain_video;
  "email/provider": typeof email_provider;
  "email/templates": typeof email_templates;
  http: typeof http;
  importAcquisition: typeof importAcquisition;
  importAvatarUpload: typeof importAvatarUpload;
  importEligibility: typeof importEligibility;
  importOAuth: typeof importOAuth;
  importOAuthCommands: typeof importOAuthCommands;
  importOAuthOptions: typeof importOAuthOptions;
  invitationRecords: typeof invitationRecords;
  invitations: typeof invitations;
  members: typeof members;
  migrations: typeof migrations;
  muxWebhook: typeof muxWebhook;
  organizationAuthorization: typeof organizationAuthorization;
  organizations: typeof organizations;
  profileImages: typeof profileImages;
  projectActivity: typeof projectActivity;
  projects: typeof projects;
  publicProjection: typeof publicProjection;
  publicReadRateLimit: typeof publicReadRateLimit;
  publicWall: typeof publicWall;
  "security/organizationAccess": typeof security_organizationAccess;
  "security/principal": typeof security_principal;
  "security/publicWallAccess": typeof security_publicWallAccess;
  seed: typeof seed;
  storageCleanup: typeof storageCleanup;
  stripeBillingProvider: typeof stripeBillingProvider;
  stripeConfiguration: typeof stripeConfiguration;
  stripeWebhookReconciliation: typeof stripeWebhookReconciliation;
  stripeWebhookSync: typeof stripeWebhookSync;
  submissionManagement: typeof submissionManagement;
  submissions: typeof submissions;
  system: typeof system;
  testimonialCardValue: typeof testimonialCardValue;
  testimonialDeletion: typeof testimonialDeletion;
  testimonialImages: typeof testimonialImages;
  testimonialImportAvatar: typeof testimonialImportAvatar;
  testimonialImportSource: typeof testimonialImportSource;
  testimonialImportVideo: typeof testimonialImportVideo;
  testimonialImports: typeof testimonialImports;
  testimonialModeration: typeof testimonialModeration;
  turnstile: typeof turnstile;
  video: typeof video;
  videoImportCleanup: typeof videoImportCleanup;
  videoMedia: typeof videoMedia;
  videoProvider: typeof videoProvider;
  videoRetryDelivery: typeof videoRetryDelivery;
  videoRetryLinks: typeof videoRetryLinks;
  videoWebhooks: typeof videoWebhooks;
  wallCustomization: typeof wallCustomization;
  workspaceDeletion: typeof workspaceDeletion;
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
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
  authz: import("@djpanda/convex-authz/_generated/component.js").ComponentApi<"authz">;
  stripe: import("@convex-dev/stripe/_generated/component.js").ComponentApi<"stripe">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
};
