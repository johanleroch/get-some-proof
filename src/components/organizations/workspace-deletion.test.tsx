import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
        inboxHref="/org/acme-studio/inbox"
        onDelete={onDelete}
        onExport={onExport}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Download eligible MP4s from Inbox" }),
    ).toHaveAttribute("href", "/org/acme-studio/inbox");

    fireEvent.click(
      screen.getByRole("button", { name: "Download data first" }),
    );
    await waitFor(() => expect(onExport).toHaveBeenCalledOnce());
    expect(onDelete).not.toHaveBeenCalled();

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
      screen.getByRole("button", { name: "Delete Workspace permanently" }),
    );
    expect(onDelete).toHaveBeenCalledWith("Acme Studio");
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
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Mux asset deletion failed (503)",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry cleanup now" }));
    await waitFor(() => expect(onRetry).toHaveBeenCalledOnce());
  });
});
