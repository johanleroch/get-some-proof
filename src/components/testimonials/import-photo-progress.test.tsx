import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ImportPhotoProgress } from "./import-photo-progress";
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
const photos = [
  {
    itemId: "import-photo-1",
    authorName: "Camille",
    status: "failed" as const,
    diagnostic: "HTTP_403",
    attempt: 2,
  },
];
it("exposes safe photo failure details on keyboard focus in development", async () => {
  vi.stubEnv("NODE_ENV", "development");
  render(<ImportPhotoProgress photos={photos} onRetry={async () => {}} />);
  fireEvent.focus(
    screen.getByRole("button", { name: "Photo error details for Camille" }),
  );
  expect(await screen.findByRole("tooltip")).toHaveTextContent("HTTP_403");
  expect(screen.getByRole("tooltip")).toHaveTextContent("Attempt: 2");
});
it("does not render the diagnostic control in production", () => {
  vi.stubEnv("NODE_ENV", "production");
  render(<ImportPhotoProgress photos={photos} onRetry={async () => {}} />);
  expect(
    screen.queryByRole("button", { name: "Photo error details for Camille" }),
  ).toBeNull();
  expect(screen.queryByText(/HTTP_403/)).toBeNull();
});
