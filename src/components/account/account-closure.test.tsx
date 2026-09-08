import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { AccountDeletionSection } from "./account-closure";

beforeEach(cleanup);
it("requires an exact typed confirmation and an explicit final confirmation", async () => {
  const onDelete = vi.fn().mockResolvedValue(undefined);
  render(<AccountDeletionSection status={null} onDelete={onDelete} />);
  const review = screen.getByRole("button", {
    name: "Review account deletion",
  });
  expect(review).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Type DELETE ACCOUNT to continue"), {
    target: { value: "DELETE ACCOUNT" },
  });
  fireEvent.click(review);
  expect(onDelete).not.toHaveBeenCalled();
  expect(
    screen.getByRole("heading", {
      name: "Delete your account and every project?",
    }),
  ).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Delete account permanently" }),
  );
  await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
});
it("does not report completion while a failed cleanup is awaiting retry", () => {
  render(
    <AccountDeletionSection status={{ status: "failed" }} onDelete={vi.fn()} />,
  );
  expect(
    screen.getByRole("heading", { name: "Deleting your account" }),
  ).toBeVisible();
  expect(screen.getByText(/Deletion is not complete yet/)).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Account deleted" }),
  ).not.toBeInTheDocument();
});
