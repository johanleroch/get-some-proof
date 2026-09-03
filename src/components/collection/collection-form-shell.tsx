"use client";

import type { CSSProperties } from "react";
import { useQuery } from "convex/react";
import Image from "next/image";

import { api } from "@convex/_generated/api";
import { BrandMark } from "@/components/brand-mark";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type PublicBrand = {
  collectionFormDescription: string;
  collectionFormTitle: string;
  logoUrl: string | null;
  name: string;
  primaryColor: string;
  privacyContact: string;
  publicSlug: string;
};

export function CollectionFormShellView({ brand }: { brand: PublicBrand }) {
  return (
    <main
      className="bg-muted/30 grid min-h-svh place-items-center px-5 py-12"
      style={{ "--brand-accent": brand.primaryColor } as CSSProperties}
    >
      <Card className="w-full max-w-xl overflow-hidden shadow-xl shadow-black/5">
        <div className="h-1.5 bg-(--brand-accent)" />
        <CardHeader className="items-center text-center">
          {brand.logoUrl ? (
            <Image
              alt={`${brand.name} logo`}
              className="size-14 rounded-2xl object-cover"
              height={56}
              src={brand.logoUrl}
              unoptimized
              width={56}
            />
          ) : (
            <BrandMark className="size-14 rounded-2xl" />
          )}
          <p className="text-muted-foreground text-sm font-medium">
            {brand.name}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {brand.collectionFormTitle}
          </h1>
          <p className="text-muted-foreground max-w-md text-sm leading-6">
            {brand.collectionFormDescription}
          </p>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <div className="bg-muted/50 rounded-xl border border-dashed p-6">
            <p className="font-medium">
              Testimonial collection is opening soon.
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              This public address is reserved for {brand.name}.
            </p>
          </div>
          <p className="text-muted-foreground text-xs">
            Privacy questions: {brand.privacyContact}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export function CollectionFormShell({ publicSlug }: { publicSlug: string }) {
  const brand = useQuery(api.organizations.getByPublicSlug, { publicSlug });

  if (brand === undefined) {
    return (
      <main className="bg-muted/30 grid min-h-svh place-items-center px-5">
        <p className="text-muted-foreground text-sm" role="status">
          Loading Collection Form…
        </p>
      </main>
    );
  }

  if (brand === null) {
    return (
      <main className="bg-muted/30 grid min-h-svh place-items-center px-5 text-center">
        <div>
          <h1 className="text-2xl font-semibold">
            Collection Form unavailable
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Check the address with the Brand that shared it.
          </p>
        </div>
      </main>
    );
  }

  return <CollectionFormShellView brand={brand} />;
}
