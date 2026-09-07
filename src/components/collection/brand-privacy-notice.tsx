"use client";

import { BlobLoader } from "@/components/brand/blob-loader";

import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";

type PrivacyBrand = {
  name: string;
  privacyContact: string;
};

export function BrandPrivacyNoticeView({ brand }: { brand: PrivacyBrand }) {
  return (
    <article className="mx-auto w-full max-w-2xl space-y-6">
      <header className="space-y-1.5">
        <p className="type-micro text-ink-2">{brand.name}</p>
        <h1 className="type-heading">Testimonial privacy notice</h1>
      </header>
      <div className="type-body text-ink-2 space-y-5">
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
            className="text-ink underline underline-offset-2"
            href={`mailto:${brand.privacyContact}`}
          >
            {brand.privacyContact}
          </a>
          .
        </p>
        <p className="type-small">
          This default notice requires legal review before launch.
        </p>
      </div>
    </article>
  );
}

export function BrandPrivacyNotice({ publicSlug }: { publicSlug: string }) {
  const brand = useQuery(api.organizations.getByPublicSlug, { publicSlug });

  if (brand === undefined) {
    return <BlobLoader label="Loading notice…" />;
  }
  if (brand === null) {
    return <p className="text-ink-2 text-sm">Notice unavailable.</p>;
  }

  return <BrandPrivacyNoticeView brand={brand} />;
}
