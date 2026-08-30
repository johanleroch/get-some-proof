import authzTest from "@djpanda/convex-authz/test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api, components } from "@convex/_generated/api";
import schema from "@convex/schema";

const modules = import.meta.glob("../convex/**/*.*s");

async function authenticatedUser(
  t: ReturnType<typeof convexTest>,
  {
    email = "alice@example.com",
    name = "Alice Owner",
  }: { email?: string; name?: string } = {},
) {
  const now = Date.now();
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "user",
      data: {
        name,
        email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "session",
      data: {
        userId: String(user._id),
        token: `test-session-token-${email}`,
        expiresAt: now + 60_000,
        createdAt: now,
        updatedAt: now,
      },
    },
  });

  return t.withIdentity({
    subject: String(user._id),
    sessionId: String(session._id),
    tokenIdentifier: `test|${String(user._id)}`,
    email,
    emailVerified: true,
    name,
  });
}

describe("Organization onboarding", () => {
  it("creates an Organization, active Membership, and Owner assignment", async () => {
    const t = convexTest(schema, modules);
    betterAuthTest.register(t);
    authzTest.register(t);
    const alice = await authenticatedUser(t);

    const created = await alice.mutation(api.organizations.create, {
      name: "Acme Holdings",
    });

    expect(created.name).toBe("Acme Holdings");
    expect(created.slug).toMatch(/^acme-holdings-[a-z0-9]{4}$/);

    const organizations = await alice.query(api.organizations.listMine, {});
    expect(organizations).toEqual([
      expect.objectContaining({
        id: created.id,
        name: "Acme Holdings",
        slug: created.slug,
      }),
    ]);

    const canManageOwnership = await t.query(
      components.authz.indexed.checkPermissionFast,
      {
        tenantId: String(created.id),
        userId: created.actorId,
        permission: "ownership:manage",
      },
    );
    expect(canManageOwnership).toBe(true);

    const renamed = await alice.mutation(api.organizations.rename, {
      organizationId: created.id,
      name: "Acme Group",
    });
    expect(renamed).toEqual({
      id: created.id,
      name: "Acme Group",
      slug: created.slug,
    });
  });

  it("does not treat another Organization slug as access evidence", async () => {
    const t = convexTest(schema, modules);
    betterAuthTest.register(t);
    authzTest.register(t);
    const alice = await authenticatedUser(t);
    const bob = await authenticatedUser(t, {
      email: "bob@example.com",
      name: "Bob Viewer",
    });
    const created = await alice.mutation(api.organizations.create, {
      name: "Private Company",
    });

    expect(
      await bob.query(api.organizations.getBySlug, { slug: created.slug }),
    ).toBeNull();
  });
});
