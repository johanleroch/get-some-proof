import { describe, expect, it } from "vitest";

import {
  initialJourneyState,
  isOnboardingStepId,
  isPlaygroundMessage,
  nextStep,
  onboardingPlaygroundChannel,
  onboardingStepIds,
  onboardingSteps,
  previousStep,
  reduceJourney,
  scenarioFor,
  stageUrl,
} from "./onboarding-journey";

describe("onboarding journey", () => {
  it("lists every step once, in order, with a route and a source", () => {
    expect(onboardingSteps.map((step) => step.id)).toEqual([
      ...onboardingStepIds,
    ]);
    for (const step of onboardingSteps) {
      expect(step.route).not.toBe("");
      expect(step.source).toMatch(/\.(tsx?|md)$/);
      if (step.kind === "interstitial") {
        expect(step.autoAdvanceMs).toBeGreaterThan(0);
      }
    }
    expect(nextStep("first-overview")).toBeNull();
    expect(previousStep("sign-up")).toBeNull();
    expect(nextStep("sign-up")).toBe("check-email");
    expect(isOnboardingStepId("create-brand")).toBe(true);
    expect(isOnboardingStepId("checkout")).toBe(false);
    expect(stageUrl("create-brand")).toBe(
      "/kit/onboarding/stage?step=create-brand",
    );
  });

  it("plays the email path: sign up, verify, find no Brand, create it, open it", () => {
    const account = {
      email: "mina@fernhill.studio",
      name: "Mina Okafor",
      provider: "email" as const,
    };
    let state = reduceJourney(initialJourneyState, {
      account,
      type: "signed-up",
    });
    expect(state).toMatchObject({
      account,
      arrival: "play",
      step: "check-email",
    });
    state = reduceJourney(state, { type: "advance" });
    expect(state.step).toBe("verification-email");
    state = reduceJourney(state, { type: "email-verified" });
    expect(state).toMatchObject({ arrival: "play", step: "finding-project" });
    state = reduceJourney(state, { type: "advance" });
    expect(state.step).toBe("create-brand");
    const brand = {
      name: "Fernhill Studio",
      primaryColor: "#0f766e",
      publicSlug: "fernhill-studio",
      slug: "fernhill-studio-l5pg",
    };
    state = reduceJourney(state, { brand, type: "brand-created" });
    expect(state).toMatchObject({
      arrival: "play",
      brand,
      step: "opening-workspace",
    });
    state = reduceJourney(state, { type: "advance" });
    expect(state.step).toBe("first-overview");
    expect(reduceJourney(state, { type: "advance" })).toBe(state);
  });

  it("skips the email steps on the Google path", () => {
    const state = reduceJourney(initialJourneyState, {
      account: { email: "a@b.co", name: "A", provider: "google" },
      type: "signed-in-with-google",
    });
    expect(state.step).toBe("finding-project");
  });

  it("holds a step picked from the list and starts a fresh run on restart", () => {
    let state = reduceJourney(initialJourneyState, {
      type: "go",
      step: "finding-project",
    });
    expect(state.arrival).toBe("jump");
    state = reduceJourney(state, { type: "back" });
    expect(state).toMatchObject({
      arrival: "jump",
      step: "verification-email",
    });
    state = reduceJourney(state, {
      scenario: "slug-taken",
      step: "create-brand",
      type: "scenario",
    });
    const restarted = reduceJourney(state, { type: "restart" });
    expect(restarted).toMatchObject({
      account: null,
      brand: null,
      run: 1,
      step: "sign-up",
    });
    expect(scenarioFor(restarted, "create-brand")).toBe("slug-taken");
  });

  it("falls back to the first scenario and ignores unknown ones", () => {
    expect(scenarioFor(initialJourneyState, "sign-up")).toBe("happy");
    expect(scenarioFor(initialJourneyState, "check-email")).toBe("happy");
    expect(
      reduceJourney(initialJourneyState, {
        scenario: "nope",
        step: "sign-up",
        type: "scenario",
      }),
    ).toBe(initialJourneyState);
  });

  it("recognises only its own window messages", () => {
    expect(
      isPlaygroundMessage({
        channel: onboardingPlaygroundChannel,
        state: initialJourneyState,
        type: "state",
      }),
    ).toBe(true);
    expect(isPlaygroundMessage({ type: "state" })).toBe(false);
    expect(isPlaygroundMessage(null)).toBe(false);
  });
});
