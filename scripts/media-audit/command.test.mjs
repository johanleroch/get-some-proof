import { afterEach, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => {
  const mock = { execFileSync: vi.fn() };
  return { ...mock, default: mock };
});
vi.mock("node:fs/promises", () => {
  const mock = { mkdir: vi.fn(), writeFile: vi.fn() };
  return { ...mock, default: mock };
});

import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { main } from "./audit.mjs";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it("audits residual storage with no application tables and traverses Mux pages", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubEnv("MUX_TOKEN_ID", "test-id");
  vi.stubEnv("MUX_TOKEN_SECRET", "test-secret");
  execFileSync.mockImplementation((_binary, args) => {
    if (args.includes("data")) return "";
    return JSON.stringify({
      page: [{ _id: "storage-id", _creationTime: 1, size: 15 }],
      isDone: true,
      continueCursor: "",
    });
  });
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ id: "mux-one", created_at: "1" }],
        next_cursor: "page-two",
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: "mux-two", created_at: "1" }] }),
    });
  vi.stubGlobal("fetch", fetch);
  await main(["--deployment", "test-deployment"]);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[1][0].searchParams.get("cursor")).toBe("page-two");
  const report = JSON.parse(writeFile.mock.calls[0][1]);
  expect(report.summary).toEqual({
    orphan_candidate: 1,
    unreferenced_scope_unverified: 2,
  });
  expect(writeFile.mock.calls[0][2]).toEqual({ flag: "wx", mode: 0o600 });
  expect(JSON.stringify(report)).not.toContain("test-secret");
});

it("aborts a failed inventory without writing a complete report", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  execFileSync.mockImplementation(() => {
    throw new Error("private error");
  });
  await expect(
    main(["--deployment", "test-deployment", "--skip-mux"]),
  ).rejects.toThrow("Convex read failed");
  expect(writeFile).not.toHaveBeenCalled();
});
