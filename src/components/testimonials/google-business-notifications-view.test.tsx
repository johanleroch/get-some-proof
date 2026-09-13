import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { GoogleNotificationsView } from "./google-business-notifications-view";
afterEach(cleanup);

it("warns before replacing Google's account-wide destination and lets the Owner cancel", () => {
  const enable = vi.fn();
  render(
    <GoogleNotificationsView
      enabled={false}
      configured
      busy={false}
      onEnable={enable}
      onDisable={vi.fn()}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Enable automatic updates" }),
  );
  const dialog = screen.getByRole("alertdialog");
  expect(
    within(dialog).getByText(
      /Another connected tool may stop receiving notifications/,
    ),
  ).toBeVisible();
  expect(enable).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(enable).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Enable automatic updates" }),
  );
  fireEvent.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Enable automatic updates",
    }),
  );
  expect(enable).toHaveBeenCalledOnce();
});
