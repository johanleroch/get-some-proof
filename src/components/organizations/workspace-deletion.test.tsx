import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";

import {
  WorkspaceDeletionProgress,
  WorkspaceDeletionSection,
} from "./organization-settings";

describe("WorkspaceDeletionSection", () => {
  beforeEach(cleanup);

  it("keeps export independent and requires typed name plus a second confirmation", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onExport = vi.fn().mockResolvedValue(undefined);
    render(
      <WorkspaceDeletionSection
        brandName="Acme Studio"
        onDelete={onDelete}
        onExport={onExport}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Download ZIP backup" }),
    );
    await waitFor(() => expect(onExport).toHaveBeenCalledOnce());
    expect(onDelete).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Done" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    const review = screen.getByRole("button", {
      name: "Review irreversible deletion",
    });
    expect(review).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Type Acme Studio/), {
      target: { value: "Acme Studio" },
    });
    await waitFor(() => expect(review).toBeEnabled());
    fireEvent.click(review);
    expect(
      screen.getByRole("heading", { name: "Permanently delete Acme Studio?" }),
    ).toBeVisible();
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Project permanently" }),
    );
    expect(onDelete).toHaveBeenCalledWith("Acme Studio");
  });

  it("offers sign-in recovery when deletion requires a fresh session", async () => {
    const onDelete = vi.fn().mockRejectedValue(
      new ConvexError({
        code: "SESSION_NOT_FRESH",
        message: "Sign in again before permanently deleting this Brand.",
      }),
    );
    render(
      <WorkspaceDeletionSection
        brandName="Fernhill Studio"
        initialConfirmation="Fernhill Studio"
        initialDialogOpen
        onDelete={onDelete}
        onExport={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Project permanently" }),
    );
    expect(
      await screen.findByRole("link", { name: "Sign in again" }),
    ).toBeVisible();
    expect(screen.getByTestId("error-toast-message")).toHaveTextContent(
      "Sign in again to continue. This security action needs a recent sign-in.",
    );
    expect(screen.getByRole("link", { name: "Sign in again" })).toHaveAttribute(
      "href",
      `/sign-in?callbackURL=${encodeURIComponent(window.location.pathname + window.location.search + "#danger")}`,
    );
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("does not expose server details for unexpected deletion failures", async () => {
    render(
      <WorkspaceDeletionSection
        brandName="Fernhill Studio"
        initialConfirmation="Fernhill Studio"
        initialDialogOpen
        onDelete={vi
          .fn()
          .mockRejectedValue(new Error("Internal server stack trace"))}
        onExport={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Project permanently" }),
    );
    expect(await screen.findByTestId("error-toast-message")).toHaveTextContent(
      "Unable to delete this project. Try again in a moment.",
    );
    expect(
      screen.queryByRole("link", { name: "Sign in again" }),
    ).not.toBeInTheDocument();
  });

  it("keeps a failed Workspace private and offers an explicit cleanup retry", async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);
    render(
      <WorkspaceDeletionProgress
        brandName="Acme Studio"
        lastError="Mux asset deletion failed (503)"
        onRetry={onRetry}
        phase="providerCleanup"
        status="failed"
      />,
    );

    expect(
      screen.getByText(/Public access is disabled and will not be restored/),
    ).toBeVisible();
    expect(screen.getByTestId("error-toast-message")).toHaveTextContent(
      "Mux asset deletion failed (503)",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry cleanup now" }));
    await waitFor(() => expect(onRetry).toHaveBeenCalledOnce());
  });
});
