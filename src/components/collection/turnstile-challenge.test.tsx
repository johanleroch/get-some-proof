import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TurnstileChallenge } from "./turnstile-challenge";

describe("TurnstileChallenge", () => {
  afterEach(() => {
    document
      .querySelectorAll('script[data-proof-turnstile="true"]')
      .forEach((script) => script.remove());
    vi.restoreAllMocks();
  });

  it("announces script failures and lets the visitor retry", async () => {
    render(<TurnstileChallenge onToken={vi.fn()} onWidget={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Verifying this submission",
    );
    const script = document.querySelector<HTMLScriptElement>(
      'script[data-proof-turnstile="true"]',
    );
    expect(script).not.toBeNull();
    script!.dispatchEvent(new Event("error"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Verification is unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry verification" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Verifying this submission",
      ),
    );
    expect(
      document.querySelector('script[data-proof-turnstile="true"]'),
    ).not.toBeNull();
  });
});
