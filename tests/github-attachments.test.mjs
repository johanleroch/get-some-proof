import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attachmentUrl,
  publishEvidence,
  uploadAttachment,
  uploadAttachments,
} from "../scripts/visual-evidence/github-attachments.mjs";

const sha = "a".repeat(40);
const url =
  "https://github.com/user-attachments/assets/12345678-abcd-1234-abcd-123456789abc";
const screenshot = {
  path: "desktop/screen.png",
  title: "Screen",
  viewport: "desktop",
  absolutePath: "/capture/screen.png",
};
const manifest = {
  repository: "owner/repo",
  project: "project",
  headSha: sha,
  target: { kind: "pull", number: 57 },
  screenshots: [screenshot],
};
const published = async () => ({ published: [{ ...screenshot, url }] });
const temporary = [];
afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("GitHub visual attachments", () => {
  it("uploads to the explicit repository and verifies authenticated bytes", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "attachment-test-"));
    temporary.push(dir);
    const absolutePath = path.join(dir, "screen.png");
    const bytes = Buffer.from("image bytes");
    await writeFile(absolutePath, bytes);
    const run = vi
      .fn()
      .mockReturnValueOnce(`![screen.png](${url})\n`)
      .mockReturnValueOnce(bytes);
    expect(
      (
        await uploadAttachment(
          "owner/repo",
          { ...screenshot, absolutePath },
          run,
        )
      ).url,
    ).toBe(url);
    expect(run.mock.calls[0].slice(0, 2)).toEqual([
      "gh",
      ["image", "--repo", "owner/repo", absolutePath],
    ]);
    expect(run.mock.calls[1].slice(0, 2)).toEqual([
      "gh",
      ["image", "download", url, "--output", "-"],
    ]);
    const corrupt = vi
      .fn()
      .mockReturnValueOnce(`![screen.png](${url})`)
      .mockReturnValueOnce(Buffer.from("wrong bytes"));
    await expect(
      uploadAttachment("owner/repo", { ...screenshot, absolutePath }, corrupt),
    ).rejects.toThrow(/verification failed/);
  });

  it("uploads every screenshot of the manifest through the attachment transport", async () => {
    const upload = vi.fn(async (repository, item) => ({ ...item, url }));
    expect(await uploadAttachments(manifest, null, upload)).toEqual({
      published: [{ ...screenshot, url }],
    });
    expect(upload).toHaveBeenCalledWith("owner/repo", screenshot);
  });

  it.each([
    "![x](https://evil.example/x)",
    `![x](${url})\n![y](${url})`,
    `![x](${url}?token=secret)`,
    "not an upload",
  ])("rejects untrusted upload output", (value) => {
    expect(() => attachmentUrl(value)).toThrow(/one GitHub image/);
  });

  it("replaces the marked comment only after verified uploads and two head checks", async () => {
    const events = [];
    const github = vi.fn(async (pathname, options) => {
      events.push(options?.method || pathname);
      if (pathname.includes("/pulls/")) return { head: { sha } };
      if (!options)
        return [{ id: 42, body: "<!-- visual-evidence:project --> old" }];
      return {};
    });
    const transport = vi.fn(async () => {
      events.push("verified-upload");
      return { published: [{ ...screenshot, url }] };
    });
    expect(await publishEvidence(manifest, github, transport)).toEqual({
      stale: false,
      count: 1,
    });
    expect(events).toEqual([
      "/repos/owner/repo/pulls/57",
      "verified-upload",
      "/repos/owner/repo/issues/57/comments?per_page=100&page=1",
      "/repos/owner/repo/pulls/57",
      "PATCH",
    ]);
    const [pathname, options] = github.mock.calls.at(-1);
    expect(pathname).toBe("/repos/owner/repo/issues/comments/42");
    expect(JSON.parse(options.body).body).toContain(sha);
    expect(JSON.parse(options.body).body).toContain(url);
  });

  it.each([false, true])(
    "leaves the comment unchanged when the PR advances (during upload: %s)",
    async (duringUpload) => {
      let checks = 0;
      const github = vi.fn(async (pathname) =>
        pathname.includes("/pulls/")
          ? {
              head: {
                sha: duringUpload && checks++ === 0 ? sha : "b".repeat(40),
              },
            }
          : [],
      );
      const transport = vi.fn(published);
      expect((await publishEvidence(manifest, github, transport)).stale).toBe(
        true,
      );
      expect(transport).toHaveBeenCalledTimes(duringUpload ? 1 : 0);
      expect(github.mock.calls.every((call) => !call[1])).toBe(true);
    },
  );

  it("keeps the existing comment when verification fails", async () => {
    const github = vi.fn(async () => ({ head: { sha } }));
    await expect(
      publishEvidence(manifest, github, async () => {
        throw new Error("verification failed");
      }),
    ).rejects.toThrow(/verification failed/);
    expect(github).toHaveBeenCalledTimes(1);
  });

  it("publishes an issue comment and refuses to disguise a PR as an issue", async () => {
    const issue = { ...manifest, target: { kind: "issue", number: 56 } };
    const github = vi.fn(async (pathname, options) =>
      pathname.includes("comments?") ? [] : options ? {} : { number: 56 },
    );
    await publishEvidence(issue, github, published);
    expect(github.mock.calls.at(-1)[1].method).toBe("POST");
    await expect(
      publishEvidence(issue, async () => ({ pull_request: {} }), vi.fn()),
    ).rejects.toThrow(/cannot target a pull/);
  });
});
