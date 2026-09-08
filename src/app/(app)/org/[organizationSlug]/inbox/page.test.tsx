import { describe, expect, it } from "vitest";

import OrganizationInboxPage from "@/app/(app)/org/[organizationSlug]/inbox/page";
import { TestimonialInbox } from "@/components/testimonials/testimonial-inbox";

describe("Brand inbox route", () => {
  it("renders the Testimonial Inbox for the Brand named in the URL", async () => {
    const element = await OrganizationInboxPage({
      params: Promise.resolve({ organizationSlug: "acme-1234" }),
    });
    expect(element.type).toBe(TestimonialInbox);
    expect(element.props).toEqual({ slug: "acme-1234" });
  });
});
