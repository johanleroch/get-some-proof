import { describe, expect, it } from "vitest";

import {
  buildNewPendingTestimonialEmail,
  buildReplacementManagementLinkEmail,
  buildVerificationEmail,
} from "./templates";

describe("transactional email templates", () => {
  it("welcomes the new account and hands over the link", () => {
    const url = "http://localhost:3000/api/auth/verify-email?token=a&b=c";
    const message = buildVerificationEmail("mina@fernhill.studio", url);

    expect(message.subject).toBe("Welcome to Get Some Proof");
    expect(message.html).toContain("Welcome to Get Some Proof</h1>");
    expect(message.html).toContain("Thanks for signing up.");
    expect(message.html).toContain("create your Brand");
    expect(message.html).not.toMatch(/Organization/);
    expect(message.html).toContain(
      'href="http://localhost:3000/api/auth/verify-email?token=a&amp;b=c"',
    );
    expect(message.html).toContain(">Verify my email</a>");
    expect(message.html).toContain("/brand/email/logo.png");
    expect(message.html).toContain("#ffbb16");
    expect(message.text).toContain(url);
    expect(message.text).toContain("you can ignore this email");
  });

  it("escapes what it prints", () => {
    const message = buildVerificationEmail(
      "mina@fernhill.studio",
      "http://localhost:3000/x?q=<b>",
    );
    expect(message.html).not.toContain("q=<b>");
    expect(message.html).toContain("q=&lt;b&gt;");
  });

  it("lists every replacement link inside the same layout", () => {
    const message = buildReplacementManagementLinkEmail({
      brandName: "Fernhill Studio",
      email: "remy@example.invalid",
      urls: ["http://localhost:3000/s/one", "http://localhost:3000/s/two"],
    });
    expect(message.html).toContain("Manage submission 1");
    expect(message.html).toContain("Manage submission 2");
    expect(message.html).toContain("/brand/email/logo.png");
    expect(message.text).toContain("Submission 2: http://localhost:3000/s/two");
  });

  it("tells an Owner why a notification arrives", () => {
    const message = buildNewPendingTestimonialEmail({
      brandName: "Fernhill Studio",
      email: "mina@fernhill.studio",
      submissionType: "text",
      submitterName: "Remy Jupille",
      url: "http://localhost:3000/org/fernhill-studio-l5pg/inbox",
    });
    expect(message.html).toContain("because you own Fernhill Studio");
    expect(message.text).toContain("because you own Fernhill Studio");
  });
});
