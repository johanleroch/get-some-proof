import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceDeletionSection } from "./organization-settings";

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
});
