import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MediaDeletionProgress } from "./media-deletion-progress";

afterEach(cleanup);

it("keeps progress indeterminate until the inventory is complete", () => {
  render(<MediaDeletionProgress status="requested" />);
  expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  expect(screen.getByRole("status")).toHaveTextContent(
    "Counting images and videos",
  );
});

it("reports confirmed media receipts without announcing the item deleted early", () => {
  const progress = {
    imagesTotal: 2,
    imagesDeleted: 2,
    videosTotal: 2,
    videosDeleted: 0,
    uploadsTotal: 0,
    uploadsDeleted: 0,
    inventoryComplete: true,
  };
  const { rerender } = render(
    <MediaDeletionProgress status="requested" progress={progress} />,
  );
  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "50",
  );
  rerender(
    <MediaDeletionProgress
      status="requested"
      progress={{ ...progress, videosDeleted: 2 }}
    />,
  );
  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "Media cleaned up. Finishing deletion",
  );
  rerender(
    <MediaDeletionProgress
      status="failed"
      progress={{ ...progress, videosDeleted: 2 }}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "Cleanup needs another attempt",
  );
  expect(screen.queryByText("Deletion complete")).toBeNull();
});
