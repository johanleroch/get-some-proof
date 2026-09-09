import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignUpFormView } from "./sign-up-form";

vi.mock("@/lib/auth-client", () => ({ authClient: {} }));

function fill() {
  fireEvent.change(screen.getByLabelText("Full name"), {
    target: { value: "Mina Okafor" },
  });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "mina@fernhill.studio" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "correct-horse-battery" },
  });
}

describe("SignUpFormView", () => {
  beforeEach(() => cleanup());

  it("sends the form to the auth call and turns into the email notice", async () => {
    const signUp = vi.fn().mockResolvedValue({ error: null });
    const onEmailSent = vi.fn();
    render(<SignUpFormView onEmailSent={onEmailSent} signUp={signUp} />);

    fill();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Check your email" }),
      ).toBeInTheDocument(),
    );
    expect(signUp).toHaveBeenCalledWith({
      callbackURL: "/dashboard",
      email: "mina@fernhill.studio",
      name: "Mina Okafor",
      password: "correct-horse-battery",
    });
    expect(onEmailSent).toHaveBeenCalledWith({
      email: "mina@fernhill.studio",
      name: "Mina Okafor",
    });
  });

  it("shows the auth error and keeps the form", async () => {
    const signUp = vi
      .fn()
      .mockResolvedValue({ error: { message: "User already exists" } });
    render(<SignUpFormView signUp={signUp} />);

    fill();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(screen.getByTestId("error-toast-message")).toHaveTextContent(
        "User already exists",
      ),
    );
    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).toBeInTheDocument();
  });

  it("hands the Google button its stand-in round trip", async () => {
    const signInWithGoogle = vi.fn().mockResolvedValue({
      error: { message: "Google sign-in is not configured." },
    });
    render(
      <SignUpFormView signInWithGoogle={signInWithGoogle} signUp={vi.fn()} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("error-toast-message")).toHaveTextContent(
        "Google sign-in is not configured.",
      ),
    );
    expect(signInWithGoogle).toHaveBeenCalledWith({
      callbackURL: "/dashboard",
    });
  });
});
