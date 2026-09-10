import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import { AssistantFileUpload } from "./assistant-file-upload";
const { issue } = vi.hoisted(() => ({ issue: vi.fn() }));
vi.mock("convex/react", () => ({ useAction: () => issue }));
const props = {
  jobId: "job" as Id<"testimonialImportJobs">,
  itemId: "item" as Id<"testimonialImportItems">,
  authorName: "Camille Roche",
  eligible: true,
};
const cap = {
  status: "uploading",
  uploadUrl: "https://fixture.convex.site/api/import-mcp/upload",
  uploadToken: "a".repeat(64),
  expiresAt: Date.now() + 900_000,
  totalBytes: 4,
  chunkSize: 4,
  offset: 0,
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  issue.mockReset();
});
it("keeps transferring when the reactive item becomes Processing and reports uploaded separately from Ready", async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  issue.mockResolvedValue(cap);
  const view = render(<AssistantFileUpload {...props} />);
  fireEvent.change(screen.getByLabelText("Choose a video for Camille Roche"), {
    target: {
      files: [new File(["test"], "camille.mp4", { type: "video/mp4" })],
    },
  });
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  view.rerender(<AssistantFileUpload {...props} eligible={false} />);
  expect(fetcher.mock.calls[0][1]!.signal!.aborted).toBe(false);
  await act(async () =>
    finish(new Response(JSON.stringify({ offset: 4, complete: true }))),
  );
  expect(
    await screen.findByText(
      "File uploaded. Checking the video before it becomes Ready.",
    ),
  ).toBeVisible();
  view.rerender(<AssistantFileUpload {...props} eligible={false} ready />);
  expect(
    screen.queryByText(
      "File uploaded. Checking the video before it becomes Ready.",
    ),
  ).not.toBeInTheDocument();
  view.rerender(<AssistantFileUpload {...props} eligible />);
  expect(
    screen.getByRole("button", { name: "Choose video file" }),
  ).toBeEnabled();
});
it("rejects unsupported files locally and starts a fresh request after a permanent provider refusal", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 422 }));
  vi.stubGlobal("fetch", fetcher);
  issue.mockResolvedValue(cap);
  render(<AssistantFileUpload {...props} />);
  const input = screen.getByLabelText("Choose a video for Camille Roche");
  fireEvent.change(input, {
    target: {
      files: [new File(["test"], "document.pdf", { type: "application/pdf" })],
    },
  });
  expect(screen.getByRole("alert")).toHaveTextContent("Choose an MP4");
  expect(issue).not.toHaveBeenCalled();
  const file = new File(["test"], "camille.mp4", { type: "video/mp4" });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "could not be uploaded",
    ),
  );
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(issue).toHaveBeenCalledTimes(2));
  expect(issue.mock.calls[0][0].requestId).not.toBe(
    issue.mock.calls[1][0].requestId,
  );
});

it("lets an accepted transfer resume after Pro ends and keeps the action label while loading", async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValue(new TypeError("network interrupted"));
  vi.stubGlobal("fetch", fetcher);
  issue.mockResolvedValue(cap);
  const view = render(<AssistantFileUpload {...props} />);
  fireEvent.change(screen.getByLabelText("Choose a video for Camille Roche"), {
    target: {
      files: [new File(["test"], "camille.mp4", { type: "video/mp4" })],
    },
  });
  await screen.findByRole("button", { name: "Resume upload" });
  view.rerender(<AssistantFileUpload {...props} eligible={false} disabled />);
  expect(screen.getByRole("button", { name: "Resume upload" })).toBeEnabled();
  issue.mockImplementation(() => new Promise(() => {}));
  fireEvent.click(screen.getByRole("button", { name: "Resume upload" }));
  expect(screen.getByRole("button", { name: "Resume upload" })).toBeDisabled();
});
