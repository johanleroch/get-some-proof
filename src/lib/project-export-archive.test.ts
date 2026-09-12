// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import {
  buildProjectArchive,
  allowedExportUrl,
  type ExportDocument,
} from "./project-export-archive";

afterEach(() => vi.unstubAllGlobals());
const document = (): ExportDocument => ({
  organization: { _id: "project", publicSlug: "atelier" },
  testimonials: [
    {
      _id: "review",
      text: "Customer proof",
      importOrigin: { originalAvatarUrl: "https://old.example/avatar.jpg" },
    },
  ],
  media: [
    {
      ownerId: "review",
      path: "images/review/avatar.png",
      kind: "image",
      url: "https://test.convex.cloud/api/storage/image",
    },
    {
      ownerId: "review",
      path: "videos/review.mp4",
      kind: "video",
      url: "https://mezzanine.mux.com/asset/mezzanine.mp4?signature=secret",
    },
  ],
});
it("archives actual image and video bytes and portable paths, without signed download URLs", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(url.includes("mux") ? "VIDEO-BYTES" : "IMAGE-BYTES", {
          headers: {
            "content-type": url.includes("mux") ? "video/mp4" : "image/png",
          },
        }),
    ),
  );
  const result = await buildProjectArchive(
    document(),
    "https://test.convex.cloud",
    new AbortController().signal,
  );
  try {
    const bytes = await readFile(result.path);
    expect(result.complete).toBe(true);
    for (const content of [
      "IMAGE-BYTES",
      "VIDEO-BYTES",
      "data.json",
      "export-report.json",
      "mediaPaths",
      "images/review/avatar.png",
      "videos/review.mp4",
    ])
      expect(bytes.includes(Buffer.from(content))).toBe(true);
    expect(bytes.includes(Buffer.from("signature=secret"))).toBe(false);
    expect(bytes.includes(Buffer.from("https://old.example/avatar.jpg"))).toBe(
      true,
    );
  } finally {
    await result.cleanup();
  }
});
it("reports a failed media request without pretending the archive is complete", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("not found", { status: 404 })),
  );
  const result = await buildProjectArchive(
    document(),
    "https://test.convex.cloud",
    new AbortController().signal,
  );
  try {
    expect(result.complete).toBe(false);
    expect(
      (await readFile(result.path)).includes(
        Buffer.from('"status": "missing"'),
      ),
    ).toBe(true);
  } finally {
    await result.cleanup();
  }
});
it("only downloads hosted storage and Mux files, never external provenance or private hosts", () => {
  for (const url of [
    "http://127.0.0.1/private",
    "https://old.example/a.png",
    "https://mezzanine.mux.com.evil.test/a",
    "https://test.convex.cloud/private",
    "https://user:password@mezzanine.mux.com/a",
  ])
    expect(allowedExportUrl(url, "https://test.convex.cloud")).toBe(false);
  expect(
    allowedExportUrl(
      "http://127.0.0.1:3290/api/storage/id",
      "http://127.0.0.1:3290",
    ),
  ).toBe(true);
});
