import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AccountInvoicesView } from "./account-invoices";

afterEach(cleanup);
const handlers = () => ({
  onRetry: vi.fn(),
  onLoadMore: vi.fn(),
  onOpenPortal: vi.fn().mockResolvedValue(undefined),
  canManageBilling: true,
});
it("shows historical invoices, PDF downloads, pagination and billing management on Free", async () => {
  const props = handlers();
  render(
    <AccountInvoicesView
      {...props}
      page={{
        invoices: [
          {
            id: "in_test",
            number: "GSP-001",
            amount: 29000,
            currency: "eur",
            created: 1790000000,
            status: "paid",
            pdfUrl: "https://invoice.stripe.com/i/test/pdf",
            hostedUrl: null,
          },
        ],
        nextCursor: "in_test",
      }}
    />,
  );
  expect(
    screen.getByRole("link", { name: "Download PDF GSP-001" }),
  ).toHaveAttribute("href", "https://invoice.stripe.com/i/test/pdf");
  fireEvent.click(screen.getByRole("button", { name: "Load more invoices" }));
  expect(props.onLoadMore).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Manage billing" }));
  await waitFor(() => expect(props.onOpenPortal).toHaveBeenCalledOnce());
});
it("supports empty and retry states", () => {
  const props = handlers();
  const { rerender } = render(
    <AccountInvoicesView
      {...props}
      page={{ invoices: [], nextCursor: null }}
    />,
  );
  expect(screen.getByText("No invoices yet.")).toBeVisible();
  rerender(<AccountInvoicesView {...props} error />);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(props.onRetry).toHaveBeenCalledOnce();
});
