import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OnboardingStage } from "./onboarding-stage";

vi.mock("@/lib/auth-client", () => ({ authClient: {} }));
vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div>Theme control</div>,
}));
vi.mock("@/components/profile-image/profile-image-control", () => ({
  ProfileImageControl: ({ onUpload }: { onUpload: (blob: Blob) => void }) => (
    <button
      onClick={() => onUpload(new Blob(["logo"], { type: "image/jpeg" }))}
      type="button"
    >
      Stage test logo
    </button>
  ),
}));

describe("OnboardingStage", () => {
  /* Unmount after each test, not just before the next one: the last tree
     would otherwise stay mounted past the end of the file and React's
     scheduler would reach for `window` after the environment is gone. */
  afterEach(cleanup);

  it("plays the account form into the email notice with the typed account", async () => {
    render(<OnboardingStage initialStep="sign-up" />);

    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Mina Okafor" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "mina@fernhill.studio" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-horse-battery" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(
      () =>
        expect(
          screen.getByRole("heading", { name: "Check your email" }),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(
      screen.queryByRole("heading", { name: "Create your account" }),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "Return to sign in" }),
    ).toHaveAttribute("href", "/sign-in?callbackURL=%2Fdashboard");
  });

  it("shows the real verification email and follows its button back in", () => {
    render(<OnboardingStage initialStep="verification-email" />);

    expect(
      screen.getByRole("heading", { name: "Welcome to Get Some Proof" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Verify my email" }));

    expect(screen.getByText("Finding your project…")).toBeInTheDocument();
  });

  it("refuses the address when the scenario says it is taken", async () => {
    render(
      <OnboardingStage
        initialScenarios={{ "create-brand": "slug-taken" }}
        initialStep="create-brand"
      />,
    );

    fireEvent.change(screen.getByLabelText("Brand name"), {
      target: { value: "Fernhill Studio" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Brand" }));

    await waitFor(
      () =>
        expect(screen.getByRole("alert")).toHaveTextContent("already taken"),
      { timeout: 3000 },
    );
    expect(screen.getByLabelText("Public address")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("opens the first Overview on the Brand that was just created", () => {
    render(<OnboardingStage initialStep="first-overview" />);

    expect(
      screen.getByRole("heading", { name: "Fernhill Studio" }),
    ).toBeInTheDocument();
  });
});
