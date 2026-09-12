// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  fetchAuthAction: vi.fn(),
  buildProjectArchive: vi.fn(),
}));
vi.mock("@/lib/auth-server", () => ({
  fetchAuthAction: mocks.fetchAuthAction,
}));
vi.mock("@/lib/project-export-archive", () => ({
  buildProjectArchive: mocks.buildProjectArchive,
}));
import { POST } from "./route";
afterEach(() => vi.resetAllMocks());
it("rejects cross-origin export requests without accessing private data", async () => {
  const response = await POST(
    new Request("https://app.example/api/project-export", {
      method: "POST",
      headers: { origin: "https://other.example" },
      body: JSON.stringify({ organizationId: "project" }),
    }),
  );
  expect(response.status).toBe(403);
  expect(mocks.fetchAuthAction).not.toHaveBeenCalled();
});
it("does not download media when the authenticated ownership check fails", async () => {
  mocks.fetchAuthAction.mockRejectedValue(new Error("Not authorized"));
  const response = await POST(
    new Request("https://app.example/api/project-export", {
      method: "POST",
      headers: { origin: "https://app.example" },
      body: JSON.stringify({ organizationId: "project" }),
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.text()).toContain('"type":"error"');
  expect(mocks.buildProjectArchive).not.toHaveBeenCalled();
});
