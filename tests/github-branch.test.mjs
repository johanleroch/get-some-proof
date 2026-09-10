import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { publishEvidence } from "../scripts/visual-evidence/github-attachments.mjs";
import {
  downloadRaw,
  evidenceRef,
  rawUrl,
  uploadToRef,
} from "../scripts/visual-evidence/github-branch.mjs";

const headSha = "a".repeat(40);
const commitSha = "c".repeat(40);
const bytes = Buffer.from("image bytes");
const temporary = [];

async function capture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "evidence-ref-test-"));
  temporary.push(dir);
  const absolutePath = path.join(dir, "screen.png");
  await writeFile(absolutePath, bytes);
  return {
    repository: "owner/repo",
    project: "project",
    headSha,
    target: { kind: "pull", number: 57 },
    screenshots: [
      {
        path: "desktop/screen.png",
        title: "Screen",
        viewport: "desktop",
        absolutePath,
      },
    ],
  };
}

/** GitHub as the transport sees it: blobs are stored and read back. */
function fakeGitHub(events, { refExists = true, stored = bytes } = {}) {
  return vi.fn(async (pathname, options) => {
    events.push(`${options?.method ?? "GET"} ${pathname}`);
    if (pathname.endsWith("/git/blobs"))
      return { sha: `blob-${events.length}` };
    if (pathname.includes("/git/blobs/"))
      return { content: stored.toString("base64"), encoding: "base64" };
    if (pathname.endsWith("/git/trees")) return { sha: "tree-sha" };
    if (pathname.endsWith("/git/commits")) return { sha: commitSha };
    if (pathname.includes("/git/refs/")) {
      if (!refExists)
        throw new Error("GitHub API 422: Reference does not exist");
      return {};
    }
    if (pathname.endsWith("/git/refs")) return {};
    if (pathname.includes("/pulls/")) return { head: { sha: headSha } };
    if (!options) return [];
    return {};
  });
}

afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("evidence ref transport", () => {
  it("names the ref by target and pins raw URLs to the commit", () => {
    expect(evidenceRef({ target: { kind: "pull", number: 57 } })).toBe(
      "refs/visual-evidence/pull-57",
    );
    expect(evidenceRef({ target: { kind: "issue", number: 9 } })).toBe(
      "refs/visual-evidence/issue-9",
    );
    expect(rawUrl("owner/repo", commitSha, "desktop/screen.png")).toBe(
      `https://raw.githubusercontent.com/owner/repo/${commitSha}/desktop/screen.png`,
    );
  });

  it("writes blobs, a tree with the manifest, a parentless commit and a forced ref, then reads every blob back", async () => {
    const manifest = await capture();
    const events = [];
    const github = fakeGitHub(events);
    const probe = vi.fn(async () => {});

    const result = await uploadToRef(manifest, github, { probe });

    expect(result).toEqual({
      published: [
        {
          ...manifest.screenshots[0],
          url: rawUrl("owner/repo", commitSha, "desktop/screen.png"),
        },
      ],
      ref: "refs/visual-evidence/pull-57",
      commit: commitSha,
    });
    expect(events).toEqual([
      "POST /repos/owner/repo/git/blobs",
      "POST /repos/owner/repo/git/blobs",
      "POST /repos/owner/repo/git/trees",
      "POST /repos/owner/repo/git/commits",
      "PATCH /repos/owner/repo/git/refs/visual-evidence/pull-57",
      "GET /repos/owner/repo/git/blobs/blob-1",
    ]);
    const body = (suffix) =>
      JSON.parse(
        github.mock.calls.find(([pathname]) => pathname.endsWith(suffix))[1]
          .body,
      );
    expect(body("/git/blobs")).toEqual({
      content: bytes.toString("base64"),
      encoding: "base64",
    });
    expect(body("/git/trees").tree.map((entry) => entry.path)).toEqual([
      "desktop/screen.png",
      "manifest.json",
    ]);
    expect(body("/git/trees").tree[0].sha).toBe("blob-1");
    expect(body("/git/commits").parents).toEqual([]);
    expect(body("/git/commits").message).toContain(headSha);
    expect(body("/git/refs/visual-evidence/pull-57")).toEqual({
      sha: commitSha,
      force: true,
    });
    expect(probe).toHaveBeenCalledWith(result.published[0].url);
  });

  it("creates the ref the first time a target is published", async () => {
    const manifest = await capture();
    const events = [];
    const github = fakeGitHub(events, { refExists: false });

    await uploadToRef(manifest, github);

    expect(events.slice(-3)).toEqual([
      "PATCH /repos/owner/repo/git/refs/visual-evidence/pull-57",
      "POST /repos/owner/repo/git/refs",
      "GET /repos/owner/repo/git/blobs/blob-1",
    ]);
    expect(
      JSON.parse(
        github.mock.calls.find(([pathname]) =>
          pathname.endsWith("/git/refs"),
        )[1].body,
      ),
    ).toEqual({ ref: "refs/visual-evidence/pull-57", sha: commitSha });
  });

  it("refuses a blob that does not read back identical, and leaves the comment alone", async () => {
    const manifest = await capture();
    const github = fakeGitHub([], { stored: Buffer.from("wrong bytes") });
    const transport = (target, api) => uploadToRef(target, api);

    await expect(publishEvidence(manifest, github, transport)).rejects.toThrow(
      /verification failed/,
    );
    expect(
      github.mock.calls.some(
        ([pathname, options]) =>
          pathname.includes("/issues/") && options?.method,
      ),
    ).toBe(false);
  });

  it("names the hosting in the comment it writes", async () => {
    const manifest = await capture();
    const github = fakeGitHub([]);
    const transport = (target, api) => uploadToRef(target, api);

    expect(await publishEvidence(manifest, github, transport)).toEqual({
      stale: false,
      count: 1,
      ref: "refs/visual-evidence/pull-57",
      commit: commitSha,
    });
    const [pathname, options] = github.mock.calls.at(-1);
    expect(pathname).toBe("/repos/owner/repo/issues/57/comments");
    expect(options.method).toBe("POST");
    const comment = JSON.parse(options.body).body;
    expect(comment).toContain(headSha);
    expect(comment).toContain(
      rawUrl("owner/repo", commitSha, "desktop/screen.png"),
    );
    expect(comment).toContain("refs/visual-evidence/pull-57");
  });

  it("waits out a raw host that has not caught up or is busy, and gives up on anything else", async () => {
    const url = rawUrl("owner/repo", commitSha, "desktop/screen.png");
    const ok = {
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce(ok);
    const wait = vi.fn(async () => {});

    expect(
      Buffer.from(await downloadRaw(url, "token", { fetcher, wait })),
    ).toEqual(bytes);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[0][1].headers).toEqual({
      Authorization: "token token",
    });
    expect(wait.mock.calls.map(([ms]) => ms)).toEqual([2000, 4000]);

    const forbidden = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    await expect(
      downloadRaw(url, "", { fetcher: forbidden, wait }),
    ).rejects.toThrow(/403/);
    expect(forbidden).toHaveBeenCalledTimes(1);
  });
});
