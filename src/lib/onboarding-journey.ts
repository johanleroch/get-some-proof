import { defaultPrimaryColor } from "@convex/domain/brand";

/**
 * The first journey, from the account form to the first Overview, as the
 * onboarding playground (`/kit/onboarding`) plays it on sample data. The
 * steps are the screens a new Owner really meets, in order, each standing
 * in for a route; the reducer is the one state machine the control page and
 * the stage share.
 */
export const onboardingStepIds = [
  "sign-up",
  "check-email",
  "verification-email",
  "finding-project",
  "create-brand",
  "opening-workspace",
  "first-overview",
] as const;

export type OnboardingStepId = (typeof onboardingStepIds)[number];

export type OnboardingScenario = {
  description: string;
  id: string;
  label: string;
};

export type OnboardingStep = {
  /** Interstitials move on by themselves after this long, when played. */
  autoAdvanceMs?: number;
  description: string;
  id: OnboardingStepId;
  kind: "email" | "interstitial" | "screen";
  /** The real route (or file) this stage stands in for. */
  route: string;
  scenarios: readonly OnboardingScenario[];
  /** Where the screen is drawn, for the designer who wants to edit it. */
  source: string;
  title: string;
};

export const onboardingSteps: readonly OnboardingStep[] = [
  {
    description:
      "Name, email and password, or Google. An email address must be verified before anything else happens.",
    id: "sign-up",
    kind: "screen",
    route: "/sign-up",
    scenarios: [
      {
        description:
          "The account is created and the verification email goes out.",
        id: "happy",
        label: "Works",
      },
      {
        description:
          "The address already has an account. The message is the auth library's own.",
        id: "email-taken",
        label: "Email already used",
      },
      {
        description: "Google is not configured on this deployment.",
        id: "google-unavailable",
        label: "Google not configured",
      },
    ],
    source: "src/components/auth/sign-up-form.tsx",
    title: "Create your account",
  },
  {
    description:
      "The same page once the email has gone out. The person leaves for their inbox here.",
    id: "check-email",
    kind: "screen",
    route: "/sign-up",
    scenarios: [],
    source: "src/components/auth/sign-up-form.tsx",
    title: "Check your email",
  },
  {
    description:
      "What lands in the inbox, rendered from the real template. The button is the way back into the product.",
    id: "verification-email",
    kind: "email",
    route: "convex/email/templates.ts",
    scenarios: [],
    source: "convex/email/templates.ts",
    title: "The verification email",
  },
  {
    description:
      "Verifying signs the person in and sends them to /dashboard, which looks for a Brand and finds none.",
    id: "finding-project",
    kind: "interstitial",
    autoAdvanceMs: 1600,
    route: "/dashboard",
    scenarios: [],
    source: "src/components/organizations/dashboard-router.tsx",
    title: "Finding your project",
  },
  {
    description:
      "The one question. The address, the colour and the wording are consequences the person can open.",
    id: "create-brand",
    kind: "screen",
    route: "/onboarding",
    scenarios: [
      {
        description: "The Brand is created and the workspace opens.",
        id: "happy",
        label: "Works",
      },
      {
        description: "Another Brand already owns that public address.",
        id: "slug-taken",
        label: "Address taken",
      },
      {
        description:
          "The Brand is created but the logo never arrives. Stage a logo first to see it.",
        id: "logo-fails",
        label: "Logo upload fails",
      },
      {
        description:
          "Creation takes three seconds, to watch the loading state.",
        id: "slow",
        label: "Slow network",
      },
    ],
    source: "src/components/organizations/organization-onboarding-form.tsx",
    title: "Create your Brand",
  },
  {
    description:
      "The route loader between the form and the first Overview: the blob looking around.",
    id: "opening-workspace",
    kind: "interstitial",
    autoAdvanceMs: 1200,
    route: "/org/:organizationSlug/dashboard",
    scenarios: [],
    source: "src/app/loading.tsx",
    title: "Opening the workspace",
  },
  {
    description:
      "The Overview as a new Brand sees it: nothing waiting yet, and the Collection Form link to share.",
    id: "first-overview",
    kind: "screen",
    route: "/org/:organizationSlug/dashboard",
    scenarios: [],
    source: "src/components/organizations/organization-dashboard.tsx",
    title: "First Overview",
  },
];

export function isOnboardingStepId(value: unknown): value is OnboardingStepId {
  return (
    typeof value === "string" &&
    (onboardingStepIds as readonly string[]).includes(value)
  );
}

export function stepIndex(id: OnboardingStepId) {
  return onboardingStepIds.indexOf(id);
}

export function stepById(id: OnboardingStepId): OnboardingStep {
  return onboardingSteps[stepIndex(id)];
}

export function nextStep(id: OnboardingStepId): OnboardingStepId | null {
  return onboardingStepIds[stepIndex(id) + 1] ?? null;
}

export function previousStep(id: OnboardingStepId): OnboardingStepId | null {
  const index = stepIndex(id);
  return index > 0 ? onboardingStepIds[index - 1] : null;
}

export type OnboardingAccount = {
  email: string;
  name: string;
  provider: "email" | "google";
};

export type OnboardingBrand = {
  name: string;
  primaryColor: string;
  publicSlug: string;
  slug: string;
};

/** Stand-ins for the steps reached before the play created the real thing. */
export const sampleAccount: OnboardingAccount = {
  email: "alex@example.test",
  name: "Alex Morgan",
  provider: "email",
};

export const sampleBrand: OnboardingBrand = {
  name: "Fernhill Studio",
  primaryColor: defaultPrimaryColor,
  publicSlug: "fernhill-studio",
  slug: "fernhill-studio-l5pg",
};

/**
 * How the current step was reached. An interstitial only moves on by itself
 * when it was played into; picked from the list, it holds still so it can be
 * looked at.
 */
export type OnboardingArrival = "jump" | "play";

export type OnboardingJourneyState = {
  account: OnboardingAccount | null;
  arrival: OnboardingArrival;
  brand: OnboardingBrand | null;
  /** Counts restarts, so every screen mounts fresh on a new play. */
  run: number;
  scenarios: Partial<Record<OnboardingStepId, string>>;
  step: OnboardingStepId;
};

export const initialJourneyState: OnboardingJourneyState = {
  account: null,
  arrival: "play",
  brand: null,
  run: 0,
  scenarios: {},
  step: "sign-up",
};

export type OnboardingJourneyAction =
  | { type: "advance" }
  | { type: "back" }
  | { brand: OnboardingBrand; type: "brand-created" }
  | { type: "email-verified" }
  | { step: OnboardingStepId; type: "go" }
  | { type: "restart" }
  | { scenario: string; step: OnboardingStepId; type: "scenario" }
  | { account: OnboardingAccount; type: "signed-in-with-google" }
  | { account: OnboardingAccount; type: "signed-up" };

/** The scenario in force for a step: the chosen one, else the step's first. */
export function scenarioFor(
  state: Pick<OnboardingJourneyState, "scenarios">,
  id: OnboardingStepId,
) {
  const step = stepById(id);
  const chosen = state.scenarios[id];
  return step.scenarios.some((scenario) => scenario.id === chosen)
    ? (chosen as string)
    : (step.scenarios[0]?.id ?? "happy");
}

export function reduceJourney(
  state: OnboardingJourneyState,
  action: OnboardingJourneyAction,
): OnboardingJourneyState {
  switch (action.type) {
    case "advance": {
      const step = nextStep(state.step);
      return step ? { ...state, arrival: "play", step } : state;
    }
    case "back": {
      const step = previousStep(state.step);
      return step ? { ...state, arrival: "jump", step } : state;
    }
    case "go":
      return { ...state, arrival: "jump", step: action.step };
    case "restart":
      return {
        ...initialJourneyState,
        run: state.run + 1,
        scenarios: state.scenarios,
      };
    case "scenario": {
      const step = stepById(action.step);
      if (!step.scenarios.some((scenario) => scenario.id === action.scenario)) {
        return state;
      }
      return {
        ...state,
        scenarios: { ...state.scenarios, [action.step]: action.scenario },
      };
    }
    case "signed-up":
      return {
        ...state,
        account: action.account,
        arrival: "play",
        step: "check-email",
      };
    case "signed-in-with-google":
      return {
        ...state,
        account: action.account,
        arrival: "play",
        step: "finding-project",
      };
    case "email-verified":
      return { ...state, arrival: "play", step: "finding-project" };
    case "brand-created":
      return {
        ...state,
        arrival: "play",
        brand: action.brand,
        step: "opening-workspace",
      };
  }
}

/** The stage lives in an iframe so each device width is a real viewport. */
export const onboardingStagePath = "/kit/onboarding/stage";

export function stageUrl(step: OnboardingStepId) {
  return `${onboardingStagePath}?step=${step}`;
}

export const onboardingPlaygroundChannel =
  "get-some-proof-onboarding-playground";

export type OnboardingPlaygroundMessage =
  | {
      action: OnboardingJourneyAction;
      channel: typeof onboardingPlaygroundChannel;
      type: "action";
    }
  | {
      channel: typeof onboardingPlaygroundChannel;
      state: OnboardingJourneyState;
      type: "state";
    };

export function isPlaygroundMessage(
  data: unknown,
): data is OnboardingPlaygroundMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { channel?: unknown }).channel === onboardingPlaygroundChannel &&
    ((data as { type?: unknown }).type === "action" ||
      (data as { type?: unknown }).type === "state")
  );
}
