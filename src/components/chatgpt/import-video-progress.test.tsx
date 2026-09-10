import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { App } from "@modelcontextprotocol/ext-apps";
import { ImportVideoProgress } from "./import-video-progress";

afterEach(cleanup);

it("explains capacity refusal without incorrectly asking for account reconnection", async () => {
  const callServerTool = vi
    .fn()
    .mockResolvedValueOnce({ structuredContent: snapshot("failed") })
    .mockResolvedValueOnce({
      isError: true,
      _meta: { importError: "VIDEO_CAPACITY_REACHED" },
    });
  render(
    <ImportVideoProgress
      jobId="job-willow"
      callTool={callServerTool as App["callServerTool"]}
      onUpdate={vi.fn()}
    />,
  );
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Retry video for Camille Roche",
    }),
  );
  await screen.findByText(/Free a video storage place or wait for cleanup/);
  expect(screen.queryByText(/Reconnect your account/)).not.toBeInTheDocument();
  expect(screen.getByText("Failed", { exact: true })).toBeInTheDocument();
});

const snapshot = (
  status: "processing" | "failed" | "ready",
  jobId = "job-willow",
) => ({
  jobId,
  organizationSlug: "willow",
  inboxUrl: `https://proof.example/org/willow/inbox?import=${jobId}`,
  result: {
    imported: status === "ready" ? 1 : 0,
    skipped: 0,
    changed: 0,
    unavailable: 0,
    processing: status === "processing" ? 1 : 0,
    failed: status === "failed" ? 1 : 0,
  },
  videos: [{ itemId: "video-camille", authorName: "Camille Roche", status }],
});

it("refreshes persisted video states and retries the same failed item", async () => {
  const callServerTool = vi
    .fn()
    .mockResolvedValueOnce({ structuredContent: snapshot("failed") })
    .mockResolvedValueOnce({ structuredContent: snapshot("processing") })
    .mockResolvedValueOnce({ structuredContent: snapshot("ready") });
  const onUpdate = vi.fn();
  render(
    <ImportVideoProgress
      jobId="job-willow"
      callTool={callServerTool as App["callServerTool"]}
      onUpdate={onUpdate}
    />,
  );
  await screen.findByText("Failed");
  fireEvent.click(
    screen.getByRole("button", { name: "Retry video for Camille Roche" }),
  );
  await screen.findByText("Processing");
  expect(callServerTool).toHaveBeenNthCalledWith(2, {
    name: "retry_import_video",
    arguments: { jobId: "job-willow", itemId: "video-camille" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Refresh progress" }));
  await screen.findByText("Ready");
  expect(onUpdate).toHaveBeenLastCalledWith(snapshot("ready"));
  expect(
    screen.queryByRole("button", { name: /Retry video/ }),
  ).not.toBeInTheDocument();
});

it("rejects a different job and ignores responses after the import is closed", async () => {
  const onUpdate = vi.fn();
  let resolve!: (value: unknown) => void;
  const callServerTool = vi
    .fn()
    .mockResolvedValueOnce({
      structuredContent: snapshot("ready", "another-job"),
    })
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
  const { unmount } = render(
    <ImportVideoProgress
      jobId="job-willow"
      callTool={callServerTool as App["callServerTool"]}
      onUpdate={onUpdate}
    />,
  );
  await screen.findByText(/Progress could not be updated/);
  expect(onUpdate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Refresh progress" }));
  await waitFor(() => expect(callServerTool).toHaveBeenCalledTimes(2));
  unmount();
  await act(async () => resolve({ structuredContent: snapshot("ready") }));
  expect(onUpdate).not.toHaveBeenCalled();
});

it("polls processing videos and stops automatically on a terminal state", async () => {
  vi.useFakeTimers();
  try {
    const callServerTool = vi
      .fn()
      .mockResolvedValueOnce({ structuredContent: snapshot("processing") })
      .mockResolvedValue({ structuredContent: snapshot("ready") });
    const onUpdate = vi.fn();
    const { unmount } = render(
      <ImportVideoProgress
        jobId="job-willow"
        callTool={callServerTool as App["callServerTool"]}
        onUpdate={onUpdate}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(onUpdate).toHaveBeenLastCalledWith(snapshot("ready"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(callServerTool).toHaveBeenCalledTimes(2);
    unmount();
  } finally {
    vi.useRealTimers();
  }
});
