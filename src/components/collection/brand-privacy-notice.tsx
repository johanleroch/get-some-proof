"use client";

import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type PrivacyBrand = {
  name: string;
  privacyContact: string;
};

export function BrandPrivacyNoticeView({ brand }: { brand: PrivacyBrand }) {
  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <p className="text-muted-foreground text-sm font-medium">
          {brand.name}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Testimonial privacy notice
        </h1>
      </CardHeader>
      <CardContent className="text-muted-foreground space-y-5 text-sm leading-6">
        <p>
          {brand.name} collects the testimonial content and identity details you
          choose to provide. Your name is public if the testimonial is
          published. Your photo, role, company, and rating may also be public
          when supplied and included in your consent.
        </p>
        <p>
          Your email address stays private. It is used to send your confirmation
          and private management link, and is available only to the Brand Owner
          for managing this testimonial.
        </p>
        <p>
          Get Some Proof and its hosting, database, storage, and transactional
          email providers process this data to collect, review, publish, and
          manage the testimonial. Public testimonials may appear on the hosted
          proof wall, the Brand website, and its embedded proof wall.
        </p>
        <p>
          You can use the private link sent to your email to manage your
          submission. To ask a privacy question or withdraw your publication
          permission, contact{" "}
          <a
            className="text-foreground underline underline-offset-2"
            href={`mailto:${brand.privacyContact}`}
          >
            {brand.privacyContact}
          </a>
          .
        </p>
        <p className="text-xs">
          This default notice requires legal review before launch.
        </p>
      </CardContent>
    </Card>
  );
}

export function BrandPrivacyNotice({ publicSlug }: { publicSlug: string }) {
  const brand = useQuery(api.organizations.getByPublicSlug, { publicSlug });

  if (brand === undefined) {
    return <p className="text-muted-foreground text-sm">Loading notice…</p>;
  }
  if (brand === null) {
    return <p className="text-muted-foreground text-sm">Notice unavailable.</p>;
  }

  return <BrandPrivacyNoticeView brand={brand} />;
}
