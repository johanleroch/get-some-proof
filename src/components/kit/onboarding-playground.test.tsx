import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingPlayground } from "./onboarding-playground";

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div>Theme control</div>,
}));

// The stage frame only appears once the column has been measured; jsdom
// never lays out, so hand the observer a width straight away.
class MeasuringResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}
  disconnect() {}
  observe() {
    this.callback(
      [{ contentRect: { width: 1200 } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  unobserve() {}
}
vi.stubGlobal("ResizeObserver", MeasuringResizeObserver);

describe("OnboardingPlayground", () => {
  beforeEach(() => cleanup());

  it("lists the journey, marks the current step and frames the stage on it", () => {
    render(<OnboardingPlayground initialStep="create-brand" />);

    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(7);
    expect(
      screen.getByRole("button", { name: /Create your Brand/ }),
    ).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("5 / 7")).toBeInTheDocument();
    expect(screen.getByTitle("Onboarding stage")).toHaveAttribute(
      "src",
      "/kit/onboarding/stage?step=create-brand",
    );
    expect(
      screen.getByRole("radio", { name: /Address taken/ }),
    ).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: /Works/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("moves with the controls and switches scenarios", () => {
    render(<OnboardingPlayground initialStep="sign-up" />);

    expect(
      screen.getByRole("button", { name: "Previous step" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^Next/ }));
    expect(
      screen.getByRole("button", { name: /Check your email/ }),
    ).toHaveAttribute("aria-current", "step");
    expect(screen.queryByRole("radiogroup", { name: /scenario/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Create your Brand/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Slow network/ }));
    expect(screen.getByRole("radio", { name: /Slow network/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: /First Overview/ }));
    expect(screen.getByRole("button", { name: /^Next/ })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(
      screen.getByRole("button", { name: /Create your account/ }),
    ).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("1 / 7")).toBeInTheDocument();
  });
});
