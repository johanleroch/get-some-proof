import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { authenticatedUser, createConvexTest } from "./convex-test-helpers";

afterEach(() => vi.unstubAllEnvs());
it("seeds only the synthetic local Owner, grants Pro and safely repeats", async () => {
  vi.stubEnv("SITE_URL", "http://localhost:3910");
  vi.stubEnv("ALLOW_DEMO_SEED", "true");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_fixture");
  const t = createConvexTest();
  const owner = await authenticatedUser(t, {
    email: "mcp-certification-20260910@demo.example.invalid",
  });
  const project = await owner.client.mutation(api.organizations.create, {
    name: "MCP Certification Studio",
  });
  const args = {
    organizationId: project.id,
    confirmation: "SEED_ASSISTANT_CERTIFICATION" as const,
  };
  expect(
    await t.mutation(internal.seed.assistantCertification, args),
  ).toMatchObject({ subscriptionsCreated: 1 });
  expect(await t.mutation(internal.seed.assistantCertification, args)).toEqual({
    profilesCreated: 0,
    subscriptionsCreated: 0,
  });
  expect(
    await owner.client.query(api.assistantImports.connectionStatus, {}),
  ).toMatchObject({ paid: true });
  const other = await authenticatedUser(t, { email: "ordinary@example.com" });
  const unrelated = await other.client.mutation(api.organizations.create, {
    name: "MCP Certification Other",
  });
  await expect(
    t.mutation(internal.seed.assistantCertification, {
      ...args,
      organizationId: unrelated.id,
    }),
  ).rejects.toThrow(/synthetic/);
  vi.stubEnv("SITE_URL", "https://proof.example");
  await expect(
    t.mutation(internal.seed.assistantCertification, args),
  ).rejects.toThrow(/local address/);
});
