import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  claim: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));
const router = { push: mocks.push, replace: mocks.replace };

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { emailVerified: true } } }),
  },
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useAction: () => vi.fn(),
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === "organizations:create"
      ? mocks.create
      : mocks.claim,
  useQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
  ) =>
    args === "skip"
      ? undefined
      : getFunctionName(reference) === "anonymousWallImports:read"
        ? { selectedPositions: [0] }
        : null,
  usePaginatedQuery: () => ({
    results: [],
    status: "Exhausted",
    loadMore: vi.fn(),
  }),
}));

import { PublicTestimonialImport } from "./public-testimonial-import";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem(
    "gsp-wall-import-preview",
    JSON.stringify({ token: "a".repeat(64), resume: true }),
  );
});
afterEach(() => localStorage.clear());

it("retries saving to the already-created Project after a temporary claim failure", async () => {
  mocks.create.mockResolvedValue({
    id: "project-juniper",
    slug: "atelier-juniper",
  });
  mocks.claim.mockRejectedValueOnce(new Error("Temporary claim failure"));
  mocks.claim.mockResolvedValueOnce({ jobId: "import-juniper" });
  render(<PublicTestimonialImport />);
  fireEvent.change(screen.getByLabelText("New Project name"), {
    target: { value: "Atelier Juniper" },
  });
  const button = screen.getByRole("button", {
    name: "Create Project and continue",
  });
  fireEvent.click(button);
  await waitFor(() => expect(mocks.claim).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(button).toBeEnabled());
  expect(mocks.push).not.toHaveBeenCalled();
  expect(localStorage.getItem("gsp-wall-import-preview")).not.toBeNull();
  fireEvent.click(button);
  await waitFor(() =>
    expect(mocks.push).toHaveBeenCalledWith(
      "/org/atelier-juniper/import?job=import-juniper",
    ),
  );
  expect(mocks.create).toHaveBeenCalledTimes(1);
  expect(mocks.claim).toHaveBeenNthCalledWith(2, {
    token: "a".repeat(64),
    organizationId: "project-juniper",
  });
});
