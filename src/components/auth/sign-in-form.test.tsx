import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      email: vi.fn(),
      social: vi.fn(),
    },
  },
}));

import { SignInForm } from "@/components/auth/sign-in-form";

describe("SignInForm", () => {
  it("does not expose the invitation-only magic-link transport", () => {
    render(<SignInForm callbackURL="/dashboard" />);

    expect(
      screen.queryByRole("button", { name: "Email me a sign-in link" }),
    ).not.toBeInTheDocument();
  });
});
