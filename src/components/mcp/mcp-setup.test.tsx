import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { McpSetupView } from "./mcp-setup";

const props = {
  paid: true,
  activated: true,
  origin: "https://proof.example",
  onActivate: async () => {},
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("copies credential-free commands and faithful migration instructions only after activation", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
  const { rerender } = render(<McpSetupView {...props} activated={false} />);
  expect(
    screen.getByRole("button", { name: "Copy connection commands" }),
  ).toBeDisabled();
  rerender(<McpSetupView {...props} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Copy connection commands" }),
  );
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      "claude mcp add --transport http get-some-proof https://proof.example/mcp\nclaude mcp login get-some-proof",
    ),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Copy import instructions" }),
  );
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
  expect(writeText.mock.calls[1]![0]).toContain("Save directly as Pending");
  expect(writeText.mock.calls[1]![0]).toContain("Do not rewrite");
  expect(writeText.mock.calls[1]![0]).toContain("512 MB");
});

it("keeps disconnect available after downgrading and reports failure without hiding the app", async () => {
  const onRevoke = vi.fn().mockRejectedValue(new Error("offline"));
  render(
    <McpSetupView
      {...props}
      paid={false}
      connections={[{ clientId: "codex", name: "Codex" }]}
      onRevoke={onRevoke}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Copy connection commands" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Disconnect Codex" }));
  await screen.findByText(
    "This app could not be disconnected. Check your connection and try again.",
  );
  expect(onRevoke).toHaveBeenCalledWith("codex");
  expect(
    screen.getByRole("button", { name: "Disconnect Codex" }),
  ).toBeEnabled();
});
