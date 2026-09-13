import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { GoogleBusinessView } from "./google-business-view";

it("makes configuration status and private-only review availability clear", () => {
  render(
    <GoogleBusinessView
      configured={false}
      connected={false}
      busy={false}
      page={null}
      onConnect={vi.fn()}
      onDisconnect={vi.fn()}
      onRead={vi.fn()}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Connect Google Business Profile" }),
  ).toBeDisabled();
  expect(screen.getByText(/Reviews stay private here/)).toBeVisible();
});
it("reads another review page without offering publication or rewriting the review", () => {
  const read = vi.fn();
  render(
    <GoogleBusinessView
      configured
      connected
      busy={false}
      account="accounts/12"
      location="locations/34"
      page={{
        items: [
          {
            name: "1",
            title: "Camille Roche",
            comment: "Exactly my words.",
            rating: "FIVE",
          },
        ],
        nextPageToken: "next",
      }}
      onConnect={vi.fn()}
      onDisconnect={vi.fn()}
      onRead={read}
    />,
  );
  expect(screen.getByText("Exactly my words.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(read).toHaveBeenCalledWith("accounts/12", "locations/34", "next");
  expect(
    screen.queryByRole("button", { name: /publish/i }),
  ).not.toBeInTheDocument();
});
