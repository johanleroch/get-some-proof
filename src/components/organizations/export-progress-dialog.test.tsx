import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ExportProgressDialog } from "./export-progress-dialog";
afterEach(cleanup);
it("shows real counts and the current asset without offering deletion", () => {
  render(
    <ExportProgressDialog
      open
      pending
      progress={{
        phase: "media",
        total: 8,
        processed: 3,
        failed: 1,
        current: "Video · Maya",
      }}
      error={null}
      onClose={vi.fn()}
      onRetry={vi.fn()}
    />,
  );
  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "38",
  );
  expect(screen.getByText("3 of 8 media processed")).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("Video · Maya");
  expect(screen.getByRole("button", { name: "Done" })).toBeDisabled();
  expect(screen.getByText(/1 media could not/)).toBeVisible();
});
it("keeps the initial inventory indeterminate", () => {
  render(
    <ExportProgressDialog
      open
      pending
      progress={{ phase: "preparing", total: 0, processed: 0, failed: 0 }}
      error={null}
      onClose={vi.fn()}
      onRetry={vi.fn()}
    />,
  );
  expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
});
