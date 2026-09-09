import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PasswordInput } from "@/components/ui/password-input";

describe("PasswordInput", () => {
  afterEach(cleanup);
  it("reveals and hides the same password without submitting or losing form data", () => {
    const submit = vi.fn((event) => event.preventDefault());
    render(
      <form aria-label="Credentials" onSubmit={submit}>
        <label htmlFor="test-password">Password</label>
        <PasswordInput
          id="test-password"
          name="password"
          autoComplete="current-password"
        />
      </form>,
    );
    const input = screen.getByLabelText("Password");
    fireEvent.change(input, { target: { value: "Example-only-42!" } });
    expect(input).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("Example-only-42!");
    expect(input).toHaveAttribute("autocomplete", "current-password");
    expect(
      new FormData(screen.getByRole("form") as HTMLFormElement).get("password"),
    ).toBe("Example-only-42!");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue("Example-only-42!");
    expect(submit).not.toHaveBeenCalled();
  });

  it("keeps visibility independent and disables the control with its input", () => {
    render(
      <>
        <PasswordInput aria-label="First password" />
        <PasswordInput aria-label="Second password" />
        <PasswordInput aria-label="Disabled password" disabled />
      </>,
    );
    const controls = screen.getAllByRole("button", { name: "Show password" });
    fireEvent.click(controls[0]);
    expect(screen.getByLabelText("First password")).toHaveAttribute(
      "type",
      "text",
    );
    expect(screen.getByLabelText("Second password")).toHaveAttribute(
      "type",
      "password",
    );
    expect(controls[0]).toHaveAttribute(
      "aria-controls",
      screen.getByLabelText("First password").id,
    );
    expect(controls[2]).toBeDisabled();
  });
});
