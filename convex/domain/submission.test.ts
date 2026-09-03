import { describe, expect, it } from "vitest";

import {
  buildPublicationConsent,
  buildSubmissionEmailIdempotencyKey,
  normalizeTextSubmission,
  publicationConsentVersion,
} from "./submission";

describe("text Submission domain", () => {
  it("preserves the Submitter's words while trimming outer whitespace", () => {
    const normalized = normalizeTextSubmission({
      ageConfirmed: true,
      company: "  Acme Studio  ",
      consentAccepted: true,
      email: "  ALICE@Example.com ",
      name: "  Alice Martin  ",
      rating: 5,
      role: "  Founder  ",
      text: "  This changed  how we work every single day.  ",
    });

    expect(normalized).toEqual({
      company: "Acme Studio",
      email: "alice@example.com",
      name: "Alice Martin",
      rating: 5,
      role: "Founder",
      text: "This changed  how we work every single day.",
    });
  });

  it.each([
    ["short text", "Too short"],
    ["long text", "x".repeat(2_001)],
  ])("rejects %s outside the 20 to 2,000 character range", (_label, text) => {
    expect(() =>
      normalizeTextSubmission({
        ageConfirmed: true,
        consentAccepted: true,
        email: "alice@example.com",
        name: "Alice",
        text,
      }),
    ).toThrow(/20 and 2,000/);
  });

  it("requires private email, age confirmation, and affirmative consent", () => {
    const base = {
      ageConfirmed: true,
      consentAccepted: true,
      email: "alice@example.com",
      name: "Alice",
      text: "A specific result worth sharing publicly.",
    };

    expect(() =>
      normalizeTextSubmission({ ...base, email: "not-an-email" }),
    ).toThrow(/valid email/i);
    expect(() =>
      normalizeTextSubmission({ ...base, ageConfirmed: false }),
    ).toThrow(/18/);
    expect(() =>
      normalizeTextSubmission({ ...base, consentAccepted: false }),
    ).toThrow(/consent/i);
  });

  it("records exact Brand-specific consent and only supplied public identity fields", () => {
    const consent = buildPublicationConsent({
      brandName: "Acme Studio",
      privacyContact: "privacy@acme.example",
      suppliedIdentity: {
        avatarSupplied: false,
        company: "Acme Customer",
        name: "Alice Martin",
        rating: 5,
        role: undefined,
      },
    });

    expect(consent.version).toBe(publicationConsentVersion);
    expect(consent.identityFields).toEqual(["name", "company", "rating"]);
    expect(consent.text).toContain("Acme Studio");
    expect(consent.text).toContain("name, company, and rating");
    expect(consent.text).toContain("without compensation");
    expect(consent.text).toContain("privacy@acme.example");
    expect(consent.text).not.toContain("email");
  });

  it("uses a distinct provider idempotency key for each email delivery", () => {
    const submitter = buildSubmissionEmailIdempotencyKey(
      "attempt-1",
      "delivery-submitter",
    );
    const owner = buildSubmissionEmailIdempotencyKey(
      "attempt-1",
      "delivery-owner",
    );

    expect(submitter).not.toBe(owner);
  });
});
