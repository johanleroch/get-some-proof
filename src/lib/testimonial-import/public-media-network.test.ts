// @vitest-environment node
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { beforeEach, expect, it, vi } from "vitest";
const network = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: network.lookup }));
vi.mock("node:https", () => ({ request: network.request }));
import { downloadPublicPortrait } from "./public-media";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
  "base64",
);
function reply(status: number, headers: Record<string, string>, bytes = png) {
  network.request.mockImplementationOnce((_url, options, receive) => {
    const req = new EventEmitter() as EventEmitter & { end: () => void };
    req.end = () => {
      options.lookup(
        "portrait.example",
        {},
        (error: unknown, address: string) => {
          expect(error).toBeNull();
          expect(address).toBe("93.184.216.34");
        },
      );
      const response = Object.assign(Readable.from([bytes]), {
        statusCode: status,
        headers,
      });
      receive(response);
    };
    return req;
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  network.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
});

it("copies a public portrait without forwarding credentials and pins the validated address", async () => {
  reply(200, { "content-type": "image/png" });
  const result = await downloadPublicPortrait(
    "https://portrait.example/camille.png",
  );
  expect(Buffer.from(await result.arrayBuffer())).toEqual(png);
  expect(network.request.mock.calls[0][1].headers).not.toHaveProperty(
    "Authorization",
  );
});

it("validates each redirect and rejects a private destination", async () => {
  reply(302, { location: "http://169.254.169.254/metadata" });
  await expect(
    downloadPublicPortrait("https://portrait.example/camille.png"),
  ).rejects.toThrow();
  expect(network.request).toHaveBeenCalledTimes(1);
});

it("refuses a DNS answer containing a private address", async () => {
  network.lookup.mockResolvedValue([
    { address: "93.184.216.34", family: 4 },
    { address: "10.0.0.5", family: 4 },
  ]);
  await expect(
    downloadPublicPortrait("https://portrait.example/camille.png"),
  ).rejects.toThrow();
  expect(network.request).not.toHaveBeenCalled();
});

it("rejects oversized bytes even without Content-Length and rejects disguised HTML", async () => {
  reply(
    200,
    { "content-type": "image/png" },
    Buffer.alloc(5 * 1024 * 1024 + 1),
  );
  await expect(
    downloadPublicPortrait("https://portrait.example/camille.png"),
  ).rejects.toThrow();
  reply(
    200,
    { "content-type": "image/png" },
    Buffer.from("<html>not a portrait</html>"),
  );
  await expect(
    downloadPublicPortrait("https://portrait.example/camille.png"),
  ).rejects.toThrow();
});

it("marks temporary DNS failures for retry but keeps unknown hosts permanent", async () => {
  network.lookup.mockRejectedValueOnce(
    Object.assign(new Error("DNS retry"), { code: "EAI_AGAIN" }),
  );
  await expect(
    downloadPublicPortrait("https://portrait.example/a.png"),
  ).rejects.toMatchObject({ transient: true });
  network.lookup.mockRejectedValueOnce(
    Object.assign(new Error("No host"), { code: "ENOTFOUND" }),
  );
  await expect(
    downloadPublicPortrait("https://portrait.example/a.png"),
  ).rejects.toMatchObject({ transient: false });
});

it("marks a connection interrupted after headers for retry", async () => {
  network.request.mockImplementationOnce((_url, _options, receive) => {
    const req = new EventEmitter() as EventEmitter & { end: () => void };
    req.end = () =>
      receive(
        Object.assign(
          Readable.from(
            (async function* () {
              yield png.subarray(0, 12);
              throw Object.assign(new Error("Connection reset"), {
                code: "ECONNRESET",
              });
            })(),
          ),
          { statusCode: 200, headers: { "content-type": "image/png" } },
        ),
      );
    return req;
  });
  await expect(
    downloadPublicPortrait("https://portrait.example/a.png"),
  ).rejects.toMatchObject({ transient: true });
});
