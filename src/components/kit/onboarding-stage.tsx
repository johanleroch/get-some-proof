"use client";

import {
  type MouseEvent,
  useEffect,
  useReducer,
  useRef,
  useSyncExternalStore,
} from "react";
import { ConvexError } from "convex/values";

import type { Id } from "@convex/_generated/dataModel";
import {
  normalizeBrandName,
  normalizePrimaryColor,
  normalizePublicSlug,
  publicSlugFromBrandName,
} from "@convex/domain/brand";
import { buildOrganizationSlug } from "@convex/domain/organizationSlug";
import { buildVerificationEmail } from "@convex/email/templates";
import { NavUserView } from "@/components/account/nav-user";
import { AppShellView } from "@/components/app-shell";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  SignUpFormView,
  VerificationSentNotice,
} from "@/components/auth/sign-up-form";
import { BlobLoaderScreen } from "@/components/brand/blob-loader";
import { blobToast } from "@/components/brand/blob-toast";
import { FindingProjectScreen } from "@/components/organizations/dashboard-router";
import { BrandDashboardView } from "@/components/organizations/organization-dashboard";
import { OrganizationOnboardingFormView } from "@/components/organizations/organization-onboarding-form";
import { OrganizationOnboardingScreen } from "@/components/organizations/organization-onboarding-screen";
import { OrganizationSwitcherView } from "@/components/organizations/organization-switcher";
import {
  initialJourneyState,
  isPlaygroundMessage,
  type OnboardingAccount,
  type OnboardingBrand,
  type OnboardingJourneyAction,
  type OnboardingJourneyState,
  onboardingPlaygroundChannel,
  type OnboardingStepId,
  reduceJourney,
  sampleAccount,
  sampleBrand,
  scenarioFor,
  stepById,
} from "@/lib/onboarding-journey";

/**
 * The screens of the first journey, played one at a time on sample data
 * inside the onboarding playground's frame. Every screen is the real
 * component with its backend calls replaced: the scenario decides whether
 * they succeed, fail or drag. The control page drives it by window messages
 * and mirrors the state it reports.
 */

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const playgroundOrganizationId =
  "playground-organization" as Id<"organizations">;

function subscribeToNothing() {
  return () => undefined;
}

export function OnboardingStage({
  initialScenarios = {},
  initialStep,
}: {
  initialScenarios?: OnboardingJourneyState["scenarios"];
  initialStep: OnboardingStepId;
}) {
  const [state, dispatch] = useReducer(
    reduceJourney,
    initialStep,
    (step): OnboardingJourneyState => ({
      ...initialJourneyState,
      arrival: "jump",
      scenarios: initialScenarios,
      step,
    }),
  );
  const step = stepById(state.step);
  // Framed or not: standing alone, the stage keeps its state to itself.
  const framed = useSyncExternalStore(
    subscribeToNothing,
    () => window.parent !== window,
    () => false,
  );

  useEffect(() => {
    if (!framed) return;
    window.parent.postMessage(
      { channel: onboardingPlaygroundChannel, state, type: "state" },
      window.location.origin,
    );
  }, [framed, state]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!isPlaygroundMessage(event.data) || event.data.type !== "action") {
        return;
      }
      dispatch(event.data.action);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // An interstitial played into moves on by itself, as the real one does.
  useEffect(() => {
    if (!step.autoAdvanceMs || state.arrival !== "play") return;
    const timer = setTimeout(
      () => dispatch({ type: "advance" }),
      step.autoAdvanceMs,
    );
    return () => clearTimeout(timer);
  }, [state.arrival, state.run, state.step, step.autoAdvanceMs]);

  // Links would leave the journey for a real route; say where instead.
  function guardLinks(event: MouseEvent<HTMLDivElement>) {
    const anchor = (event.target as Element).closest?.("a[href]");
    if (!anchor || anchor.closest("[data-follow-links]")) return;
    const href = anchor.getAttribute("href") ?? "";
    if (href.startsWith("#")) return;
    event.preventDefault();
    blobToast.info("This link leaves the journey.", {
      description: href,
      id: `leave:${href}`,
    });
  }

  return (
    <div data-onboarding-stage={state.step} onClickCapture={guardLinks}>
      <StepScreen
        dispatch={dispatch}
        key={`${state.run}:${state.step}`}
        state={state}
      />
    </div>
  );
}

function StepScreen({
  dispatch,
  state,
}: {
  dispatch: (action: OnboardingJourneyAction) => void;
  state: OnboardingJourneyState;
}) {
  const account = state.account ?? sampleAccount;
  const brand = state.brand ?? sampleBrand;
  switch (state.step) {
    case "sign-up":
      return (
        <SignUpStep
          dispatch={dispatch}
          scenario={scenarioFor(state, "sign-up")}
        />
      );
    case "check-email":
      return (
        <AuthShell>
          <VerificationSentNotice callbackURL="/dashboard" />
        </AuthShell>
      );
    case "verification-email":
      return (
        <VerificationEmailStep
          email={account.email}
          onVerify={() => dispatch({ type: "email-verified" })}
        />
      );
    case "finding-project":
      return <FindingProjectScreen />;
    case "create-brand":
      return (
        <CreateBrandStep
          dispatch={dispatch}
          scenario={scenarioFor(state, "create-brand")}
        />
      );
    case "opening-workspace":
      return <BlobLoaderScreen />;
    case "first-overview":
      return (
        <FirstOverviewStep
          account={account}
          brand={brand}
          justCreated={state.brand ? "Brand" : null}
        />
      );
  }
}

function SignUpStep({
  dispatch,
  scenario,
}: {
  dispatch: (action: OnboardingJourneyAction) => void;
  scenario: string;
}) {
  return (
    <AuthShell>
      <SignUpFormView
        callbackURL="/dashboard"
        onEmailSent={(account) =>
          dispatch({
            account: { ...account, provider: "email" },
            type: "signed-up",
          })
        }
        signInWithGoogle={async () => {
          await wait(600);
          if (scenario === "google-unavailable") {
            return { error: { message: "Google sign-in is not configured." } };
          }
          dispatch({
            account: { ...sampleAccount, provider: "google" },
            type: "signed-in-with-google",
          });
          return null;
        }}
        signUp={async () => {
          await wait(700);
          return scenario === "email-taken"
            ? { error: { message: "User already exists" } }
            : null;
        }}
      />
    </AuthShell>
  );
}

/**
 * The inbox, as a sample mail client: the real template on a white card,
 * because mail never follows the product's theme. The button is the link a
 * new Owner really clicks.
 */
function VerificationEmailStep({
  email,
  onVerify,
}: {
  email: string;
  onVerify: () => void;
}) {
  const message = buildVerificationEmail(
    email,
    "https://getsomeproof.com/api/auth/verify-email?token=sample&callbackURL=%2Fdashboard",
  );
  // The template addresses its images at the site the backend knows; in the
  // browser that is not this dev server, so the preview reads them from here.
  const html = message.html.replaceAll(
    /https?:\/\/[^"]+\/brand\/email\//g,
    "/brand/email/",
  );
  return (
    <main className="bg-surface-2 min-h-svh px-5 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="type-micro text-ink-2">Inbox · sample mail client</p>
        <article
          aria-label={message.subject}
          className="overflow-hidden rounded-lg border border-[#e2ddd5] bg-white text-[#26201c]"
        >
          <header className="space-y-1 border-b border-[#ebe7e0] px-6 py-4">
            <p className="text-base font-semibold">{message.subject}</p>
            <p className="text-sm text-[#645c55]">
              Get Some Proof &lt;no-reply@getsomeproof.com&gt; · to {email}
            </p>
          </header>
          <div
            dangerouslySetInnerHTML={{ __html: html }}
            data-follow-links=""

            onClick={(event) => {
              if (!(event.target as Element).closest?.("a[href]")) return;
              event.preventDefault();
              onVerify();
            }}
          />
        </article>
        <p className="type-small text-ink-2">
          The button follows the real link: it verifies the address, signs the
          person in and sends them to /dashboard.
        </p>
      </div>
    </main>
  );
}

function CreateBrandStep({
  dispatch,
  scenario,
}: {
  dispatch: (action: OnboardingJourneyAction) => void;
  scenario: string;
}) {
  // What the fake mutation wrote, handed over once the form navigates away.
  const created = useRef<OnboardingBrand | null>(null);
  return (
    <OrganizationOnboardingScreen>
      <OrganizationOnboardingFormView
        createOrganization={async (args) => {
          await wait(scenario === "slow" ? 3000 : 700);
          let brand: OnboardingBrand;
          try {
            const name = normalizeBrandName(args.name);
            brand = {
              name,
              primaryColor: normalizePrimaryColor(args.primaryColor),
              publicSlug: normalizePublicSlug(
                args.publicSlug ?? publicSlugFromBrandName(name),
              ),
              slug: buildOrganizationSlug(name, "l5pg"),
            };
          } catch (error) {
            throw new ConvexError({
              code: "INVALID_BRAND_SETTINGS",
              message:
                error instanceof Error
                  ? error.message
                  : "Invalid Brand settings.",
            });
          }
          if (scenario === "slug-taken") {
            throw new ConvexError({
              code: "PUBLIC_SLUG_UNAVAILABLE",
              message:
                "That public address is already taken. Choose another one.",
            });
          }
          created.current = brand;
          return {
            id: playgroundOrganizationId,
            publicSlug: brand.publicSlug,
            slug: brand.slug,
          };
        }}
        generateUploadUrl={async () => "playground://upload"}
        navigate={() => {
          const brand = created.current ?? sampleBrand;
          dispatch({ brand, type: "brand-created" });
        }}
        setLogo={async () => null}
        uploadImage={async () => {
          await wait(600);
          if (scenario === "logo-fails") {
            throw new Error("The upload was refused.");
          }
          return {
            storageId: "playground-logo" as Id<"_storage">,
            verificationId:
              "playground-logo-verification" as Id<"directImageVerifications">,
            metadata: {
              contentType: "image/webp" as const,
              height: 128,
              kind: "brandLogo" as const,
              originalContentType: "image/png",
              originalSize: 1024,
              size: 512,
              source: "direct" as const,
              transformVersion: "webp-v1" as const,
              width: 128,
            },
          };
        }}
      />
    </OrganizationOnboardingScreen>
  );
}

/** The Overview the moment after creation: a Free plan with nothing used. */
function FirstOverviewStep({
  account,
  brand,
  justCreated,
}: {
  account: OnboardingAccount;
  brand: OnboardingBrand;
  justCreated: "Brand" | null;
}) {
  const accountView = {
    effectivePlan: "free" as const,
    freeProjectId: playgroundOrganizationId,
    usage: {
      freeTextUsed: 0,
      freeVideoUsed: 0,
      readyVideos: 0,
      reservedVideos: 0,
    },
  };
  const collectionUrl = `https://getsomeproof.com/c/${brand.publicSlug}`;
  return (
    <AppShellView
      account={accountView}
      authorization={{
        can: { manageOwnership: true, updateOrganization: true },
      }}
      connected
      organizationId={playgroundOrganizationId}
      organizationName={brand.name}
      organizationPublicSlug={brand.publicSlug}
      organizationSlug={brand.slug}
      pathname={`/org/${brand.slug}/dashboard`}
      projectSwitcher={
        <OrganizationSwitcherView
          canCreateProject={false}
          canReadAudit={false}
          canReadBilling={false}
          canUpdateOrganization
          currentName={brand.name}
          currentSlug={brand.slug}
          loadMore={() => undefined}
          organizations={[
            {
              id: playgroundOrganizationId,
              name: brand.name,
              slug: brand.slug,
            },
          ]}
          status="Exhausted"
          switchProject={() => undefined}
        />
      }
      userMenu={
        <NavUserView
          signOut={async () => undefined}
          user={{ email: account.email, name: account.name }}
        />
      }
    >
      <BrandDashboardView
        account={accountView}
        billingHref={`/org/${brand.slug}/billing`}
        collectionUrl={collectionUrl}
        copyCollectionUrl={() => navigator.clipboard.writeText(collectionUrl)}
        justCreated={justCreated}
        name={brand.name}
        pendingCount={0}
        publicSlug={brand.publicSlug}
        slug={brand.slug}
      />
    </AppShellView>
  );
}
