import { afterEach, describe, expect, it, vi } from "vitest";
import {
  downloadImportAvatar,
  ImportAvatarError,
  maximumImportAvatarBytes,
} from "./avatar";

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const url = "https://cdn.testimonial.to/avatars/customer.png";
afterEach(() => vi.unstubAllGlobals());

describe("import avatar retrieval", () => {
  it("copies a provider image as a blob without credentials or redirects", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(png, { headers: { "content-type": "image/png" } }),
      );
    vi.stubGlobal("fetch", fetcher);
    const result = await downloadImportAvatar("testimonial-to", url);
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(png);
    expect(result.type).toBe("image/png");
    expect(fetcher).toHaveBeenCalledWith(
      new URL(url),
      expect.objectContaining({
        credentials: "omit",
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it.each([
    "http://cdn.testimonial.to/avatar.png",
    "https://cdn.testimonial.to.evil.example/avatar.png",
    "https://localhost/avatar.png",
    "https://127.0.0.1/avatar.png",
    "https://user:password@cdn.testimonial.to/avatar.png",
    "https://cdn.testimonial.to:8443/avatar.png",
    "file:///tmp/avatar.png",
  ])("rejects unsafe URLs before any request: %s", async (input) => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(downloadImportAvatar("testimonial-to", input)).rejects.toThrow(
      ImportAvatarError,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not accept a different provider's host", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(downloadImportAvatar("senja", url)).rejects.toThrow(
      ImportAvatarError,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["text/html", "image/svg+xml"])(
    "rejects a non-raster content type: %s",
    async (contentType) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(png, {
            headers: { "content-type": contentType },
          }),
        ),
      );
      await expect(downloadImportAvatar("testimonial-to", url)).rejects.toThrow(
        ImportAvatarError,
      );
    },
  );

  it("cancels a response exceeding the byte limit without a length header", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(maximumImportAvatarBytes + 1));
      },
      cancel,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(body, {
          headers: { "content-type": "image/png" },
        }),
      ),
    );
    await expect(downloadImportAvatar("testimonial-to", url)).rejects.toThrow(
      ImportAvatarError,
    );
    expect(cancel).toHaveBeenCalled();
  });

  it("does not expose provider errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("private upstream details")),
    );
    await expect(downloadImportAvatar("testimonial-to", url)).rejects.toThrow(
      "The photo could not be copied. Choose another image and try again.",
    );
  });
});

it("copies a Senja JPEG advertised as PNG using its actual image type", async () => {
  const jpeg = new Uint8Array([
    255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1,
  ]);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(jpeg, {
        headers: { "content-type": "image/png", "content-length": "12" },
      }),
    ),
  );
  const result = await downloadImportAvatar(
    "senja",
    "https://senja-io.s3.us-west-1.amazonaws.com/public/media/customer_avatar.png",
  );
  expect(result.type).toBe("image/jpeg");
  expect(new Uint8Array(await result.arrayBuffer())).toEqual(jpeg);
});

it("rejects unrecognized bytes even when advertised as a supported image", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response("<svg onload='alert(1)'/>", {
        headers: { "content-type": "image/png" },
      }),
    ),
  );
  await expect(downloadImportAvatar("testimonial-to", url)).rejects.toThrow(
    ImportAvatarError,
  );
});
