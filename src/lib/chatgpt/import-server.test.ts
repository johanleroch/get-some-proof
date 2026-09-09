import { expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  createImportServer,
  ImportAuthenticationRequired,
  ImportOperationError,
  importWidgetUri,
  type ImportGateway,
} from "./import-server";

it("exposes private progress and retry tools with OAuth challenges and job-scoped arguments", async () => {
  const result = {
    jobId: "willow-import",
    organizationSlug: "willow",
    inboxUrl: "https://proof.example/org/willow/inbox?import=willow-import",
    result: {
      imported: 0,
      skipped: 0,
      changed: 0,
      unavailable: 0,
      processing: 1,
      failed: 0,
    },
    videos: [
      {
        itemId: "video-camille",
        authorName: "Camille Roche",
        status: "processing" as const,
      },
    ],
  };
  const status = vi.fn().mockResolvedValue(result);
  const retryVideo = vi.fn().mockResolvedValue(result);
  const server = createImportServer(
    {
      preview: vi.fn(),
      read: vi.fn(),
      select: vi.fn(),
    },
    undefined,
    {
      challenge: "Bearer import-fixture",
      destinations: vi.fn(),
      status,
      retryVideo,
    },
  );
  const client = new Client({ name: "progress-contract", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const { tools } = await client.listTools();
    for (const name of ["read_testimonial_import", "retry_import_video"]) {
      expect(tools.find((tool) => tool.name === name)?._meta).toMatchObject({
        ui: { visibility: ["app"] },
        securitySchemes: [{ type: "oauth2", scopes: ["testimonials:import"] }],
      });
    }
    expect(
      (
        await client.callTool({
          name: "read_testimonial_import",
          arguments: { jobId: result.jobId },
        })
      ).structuredContent,
    ).toEqual(result);
    await client.callTool({
      name: "retry_import_video",
      arguments: { jobId: result.jobId, itemId: "video-camille" },
    });
    expect(retryVideo).toHaveBeenCalledWith({
      jobId: result.jobId,
      itemId: "video-camille",
    });
    retryVideo.mockRejectedValueOnce(
      new ImportOperationError("VIDEO_CAPACITY_REACHED"),
    );
    expect(
      await client.callTool({
        name: "retry_import_video",
        arguments: { jobId: result.jobId, itemId: "video-camille" },
      }),
    ).toMatchObject({
      isError: true,
      _meta: { importError: "VIDEO_CAPACITY_REACHED" },
    });
    status.mockRejectedValueOnce(new ImportAuthenticationRequired());
    expect(
      await client.callTool({
        name: "read_testimonial_import",
        arguments: { jobId: result.jobId },
      }),
    ).toMatchObject({
      isError: true,
      _meta: { "mcp/www_authenticate": ["Bearer import-fixture"] },
    });
  } finally {
    await client.close();
    await server.close();
  }
});

it("keeps preview capabilities outside model context and uses the same snapshot for selection", async () => {
  const token = "b".repeat(64);
  let selectedPositions: number[] = [];
  const gateway: ImportGateway = {
    correctIdentity: vi.fn(async () => null),
    preview: vi.fn(async () => ({ token })),
    read: vi.fn<ImportGateway["read"]>(async () => ({
      provider: "senja",
      sourceUrl: "https://love.senja.io/",
      itemCount: 1,
      expiresAt: 123456,
      selectedPositions,
      items: [
        {
          position: 0,
          sourceId: "source-camille",
          type: "text",
          authorName: "Camille Laurent",
          text: "Our customers find the proof they need.",
        },
      ],
      nextOffset: null,
    })),
    select: vi.fn(async (args) => {
      selectedPositions = args.positions;
    }),
  };
  const server = createImportServer(
    gateway,
    async () => "<html><body>Import widget</body></html>",
  );
  const client = new Client({ name: "import-contract-test", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const { tools } = await client.listTools();
    expect(
      tools.find((tool) => tool.name === "preview_testimonial_wall")?._meta?.ui,
    ).toEqual({ resourceUri: importWidgetUri });
    const resource = await client.readResource({ uri: importWidgetUri });
    expect(resource.contents[0]).toMatchObject({
      mimeType: "text/html;profile=mcp-app",
      text: "<html><body>Import widget</body></html>",
    });
    expect(tools.map((tool) => tool.name)).toEqual([
      "preview_testimonial_wall",
      "read_testimonial_preview",
      "select_testimonial_preview",
      "correct_testimonial_identity",
    ]);
    expect(
      tools.find((tool) => tool.name === "select_testimonial_preview")?._meta
        ?.ui,
    ).toEqual({ visibility: ["app"] });
    const result = await client.callTool({
      name: "preview_testimonial_wall",
      arguments: { url: "https://love.senja.io/" },
    });
    expect(result.isError).not.toBe(true);
    expect(
      JSON.stringify([result.content, result.structuredContent]),
    ).not.toContain(token);
    expect(result._meta).toEqual({ previewCapability: token });
    const selected = await client.callTool({
      name: "select_testimonial_preview",
      arguments: { previewCapability: token, positions: [0] },
    });
    expect(selected.structuredContent).toMatchObject({
      selectedPositions: [0],
    });
    expect(gateway.preview).toHaveBeenCalledTimes(1);
    expect(gateway.select).toHaveBeenCalledWith({ token, positions: [0] });
    expect(
      tools.find((tool) => tool.name === "correct_testimonial_identity")?._meta
        ?.ui,
    ).toEqual({ visibility: ["app"] });
    const corrected = await client.callTool({
      name: "correct_testimonial_identity",
      arguments: {
        previewCapability: token,
        position: 0,
        authorName: " Camille Laurent ",
        tagline: " Founder ",
      },
    });
    expect(corrected.isError).not.toBe(true);
    expect(gateway.correctIdentity).toHaveBeenCalledWith({
      token,
      position: 0,
      authorName: "Camille Laurent",
      tagline: "Founder",
    });
    expect(
      JSON.stringify([corrected.content, corrected.structuredContent]),
    ).not.toContain(token);
    const invalidIdentity = await client.callTool({
      name: "correct_testimonial_identity",
      arguments: {
        previewCapability: token,
        position: 0,
        authorName: " ",
        tagline: "",
      },
    });
    expect(invalidIdentity.isError).toBe(true);
    expect(gateway.correctIdentity).toHaveBeenCalledTimes(1);
    const invalid = await client.callTool({
      name: "select_testimonial_preview",
      arguments: { previewCapability: token, positions: [500] },
    });
    expect(invalid.isError).toBe(true);
    expect(gateway.select).toHaveBeenCalledTimes(1);
  } finally {
    await client.close();
    await server.close();
  }
});

it("does not turn a backend error containing private details into a tool result", async () => {
  const server = createImportServer({
    preview: async () => {
      throw new Error("private-provider-detail");
    },
    read: vi.fn(),
    select: vi.fn(),
  });
  const client = new Client({ name: "import-error-test", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
  try {
    const result = await client.callTool({
      name: "preview_testimonial_wall",
      arguments: { url: "https://love.senja.io/" },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain("private-provider-detail");
  } finally {
    await client.close();
    await server.close();
  }
});

it("declares OAuth for Projects and returns the host linking challenge without private data", async () => {
  const challenge =
    'Bearer resource_metadata="https://proof.example/.well-known/oauth-protected-resource/mcp", error="insufficient_scope", error_description="Connect your account"';
  const destinations = vi
    .fn()
    .mockRejectedValueOnce(new ImportAuthenticationRequired())
    .mockResolvedValueOnce({
      page: [
        { id: "project-juniper", name: "Juniper Studio", slug: "juniper" },
      ],
      isDone: true,
      continueCursor: "",
    });
  const server = createImportServer(
    { preview: vi.fn(), read: vi.fn(), select: vi.fn() },
    undefined,
    { challenge, destinations },
  );
  const client = new Client({ name: "private-import-test", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
  try {
    const listing = await client.listTools();
    expect(
      listing.tools.find((t) => t.name === "list_import_projects")?._meta,
    ).toMatchObject({
      securitySchemes: [{ type: "oauth2", scopes: ["testimonials:import"] }],
    });
    const denied = await client.callTool({
      name: "list_import_projects",
      arguments: {},
    });
    expect(denied).toMatchObject({
      isError: true,
      _meta: { "mcp/www_authenticate": [challenge] },
    });
    expect(denied.structuredContent).toBeUndefined();
    const result = await client.callTool({
      name: "list_import_projects",
      arguments: {},
    });
    expect(result.structuredContent).toMatchObject({
      page: [{ name: "Juniper Studio" }],
    });
    expect(destinations).toHaveBeenLastCalledWith(null);
  } finally {
    await client.close();
    await server.close();
  }
});

it("prepares a website continuation only for an active preview and keeps its capability app-only", async () => {
  const token = "c".repeat(64);
  const read = vi
    .fn<ImportGateway["read"]>()
    .mockResolvedValueOnce({
      provider: "senja",
      sourceUrl: "https://love.senja.io",
      itemCount: 1,
      expiresAt: Date.now() + 60000,
      selectedPositions: [0],
      items: [
        {
          position: 0,
          sourceId: "camille",
          type: "text",
          authorName: "Camille",
          text: "Original words.",
        },
      ],
      nextOffset: null,
    })
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({
      provider: "senja",
      sourceUrl: "https://love.senja.io",
      itemCount: 0,
      expiresAt: 1,
      selectedPositions: [],
      items: [],
      nextOffset: null,
    });
  const server = createImportServer(
    { preview: vi.fn(), select: vi.fn(), read },
    undefined,
    undefined,
    "https://proof.example",
  );
  const client = new Client({ name: "handoff-contract", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
  try {
    const tools = await client.listTools();
    expect(
      tools.tools.find((tool) => tool.name === "continue_testimonial_import")
        ?._meta?.ui,
    ).toEqual({ visibility: ["app"] });
    const call = () =>
      client.callTool({
        name: "continue_testimonial_import",
        arguments: { previewCapability: token },
      });
    const prepared = await call();
    expect(prepared.isError).not.toBe(true);
    expect(prepared._meta?.continuationUrl).toBe(
      `https://proof.example/import/continue#preview=${token}`,
    );
    expect(
      JSON.stringify([prepared.structuredContent, prepared.content]),
    ).not.toContain(token);
    expect(prepared.structuredContent).toMatchObject({
      selectedPositions: [0],
    });
    for (let i = 0; i < 2; i++) {
      const unavailable = await call();
      expect(unavailable.isError).toBe(true);
      expect(unavailable._meta?.continuationUrl).toBeUndefined();
    }
  } finally {
    await client.close();
    await server.close();
  }
});
