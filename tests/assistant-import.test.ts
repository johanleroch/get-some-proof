import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, components, internal } from "../convex/_generated/api";
import {
  authenticatedUser,
  createConvexTest,
  addStripeSubscription,
} from "./convex-test-helpers";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAssistantTools } from "../src/lib/chatgpt/assistant-tools";

beforeEach(() => {
  vi.stubEnv("EMAIL_PROVIDER", "test");
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.stubEnv("CHATGPT_IMPORT_ENABLED", "true");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_assistant_import");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_assistant_import");
});
afterEach(() => vi.unstubAllEnvs());

it("saves original assistant-supplied text in the sole owned Project as Pending after activation", async () => {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Willow Ceramics",
  });
  await addStripeSubscription(t, project.id, "active");
  const clientId = "claude-fixture";
  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "importOAuthClient",
      data: {
        clientId,
        redirectUris: ["https://client.example/callback"],
        scopes: ["testimonials:import"],
      },
    },
  });
  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "importOAuthConsent",
      data: {
        clientId,
        userId: owner.actorId,
        scopes: ["testimonials:import"],
      },
    },
  });
  const grant = {
    actorId: owner.actorId,
    clientId,
    issuedAt: Date.now(),
    verifiedAt: Date.now(),
    expiresAt: Date.now() + 900_000,
  };
  const input = {
    grant,
    sourceUrl: "https://willow.example/customers",
    sourceId: "camille-1",
    text: "A lovely pottery class.\nI made my first bowl!",
    authorName: "Camille Roche",
  };
  await expect(
    t.mutation(internal.assistantImports.submitText, input),
  ).rejects.toThrow(/rights/i);
  await owner.client.mutation(api.assistantImports.activate, {
    organizationId: project.id,
    acceptReuseRights: true,
  });
  const result = await t.mutation(internal.assistantImports.submitText, input);
  expect(result).toMatchObject({
    organizationSlug: project.slug,
    result: { imported: 1, skipped: 0 },
  });
  const inbox = await owner.client.query(api.testimonialModeration.listInbox, {
    organizationId: project.id,
    status: "pending",
    sort: "newest",
    paginationOpts: { cursor: null, numItems: 20 },
  });
  expect(inbox.page).toHaveLength(1);
  expect(inbox.page[0]).toMatchObject({
    card: { text: input.text },
    submitterName: "Camille Roche",
    moderationStatus: "pending",
    requiresImportAttestation: true,
  });
  expect(
    (await owner.client.query(api.accounts.getMine, {}))?.usage.freeTextUsed,
  ).toBe(0);

  const server = new McpServer({
    name: "assistant-import-contract",
    version: "1",
  });
  registerAssistantTools(server, {
    submitText: (args) =>
      t.mutation(internal.assistantImports.submitText, { ...args, grant }),
  });
  const client = new Client({ name: "ordinary-model-client", version: "1" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual([
      "import_testimonial_text",
    ]);
    expect(tools.tools[0]._meta).not.toHaveProperty("ui");
    const response = await client.callTool({
      name: "import_testimonial_text",
      arguments: {
        sourceUrl: input.sourceUrl,
        sourceId: "lea-2",
        authorName: "Léa Garnier",
        text: "The glazing workshop was excellent.",
      },
    });
    expect(response.isError).not.toBe(true);
    expect(response.structuredContent).toMatchObject({
      result: { imported: 1 },
    });
  } finally {
    await client.close();
    await server.close();
  }

  const stranger = await authenticatedUser(t, { email: "other@example.com" });
  const otherProject = await stranger.client.mutation(
    api.organizations.create,
    { name: "Fern Studio" },
  );
  await expect(
    t.mutation(internal.assistantImports.submitText, {
      ...input,
      organizationId: otherProject.id,
    }),
  ).rejects.toThrow();
  await expect(
    t.mutation(internal.assistantImports.submitText, {
      ...input,
      grant: { ...grant, actorId: stranger.actorId },
    }),
  ).rejects.toThrow();
  await expect(
    stranger.client.mutation(api.assistantImports.activate, {
      organizationId: otherProject.id,
      acceptReuseRights: true,
    }),
  ).rejects.toThrow(/Pro/);
  await expect(
    t.mutation(api.assistantImports.activate, {
      organizationId: project.id,
      acceptReuseRights: true,
    }),
  ).rejects.toThrow();
  await t.mutation(components.betterAuth.adapter.updateOne, {
    input: {
      model: "importOAuthConsent",
      where: [{ field: "clientId", value: clientId }],
      update: { scopes: [] },
    },
  });
  await expect(
    t.mutation(internal.assistantImports.submitText, input),
  ).rejects.toThrow(/Connect/);
});
