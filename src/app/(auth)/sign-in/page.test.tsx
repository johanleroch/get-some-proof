import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SignInPage from "@/app/(auth)/sign-in/page";

describe("sign-in page", () => {
  it("offers password, recovery, signup, and Google paths", async () => {
    render(await SignInPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Forgot password?" }),
    ).toHaveAttribute("href", "/forgot-password");
    expect(
      screen.getByRole("link", { name: "Create an account" }),
    ).toHaveAttribute("href", "/sign-up?callbackURL=%2Fdashboard");
    expect(
      screen.queryByRole("button", { name: "Email me a sign-in link" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeInTheDocument();
  });
});
