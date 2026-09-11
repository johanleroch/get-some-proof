"use client";
import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { BlobLoader } from "@/components/brand/blob-loader";
import { getPublicEnvironment } from "@/lib/env/public-env";
import { StudioView } from "./studio-view";

export function Studio({ slug }: { slug: string }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const organization = useQuery(api.organizations.getBySlug, { slug });
  const scope = organization ? { organizationId: organization.id } : null;
  const widgets = useQuery(api.widgets.list, scope ?? "skip");
  const active = useQuery(
    api.widgets.get,
    scope && activeId
      ? { ...scope, widgetId: activeId as Id<"widgets"> }
      : "skip",
  );
  const settings = useQuery(api.wallCustomization.getSettings, scope ?? "skip");
  const { results, status, loadMore } = usePaginatedQuery(
    api.widgets.candidates,
    scope ?? "skip",
    { initialNumItems: 20 },
  );
  const create = useMutation(api.widgets.create);
  const save = useMutation(api.widgets.save);
  const unpublish = useMutation(api.widgets.unpublish);
  const remove = useMutation(api.widgets.remove);
  const env = getPublicEnvironment();
  if (organization === null) return <p className="p-8">Project unavailable.</p>;
  if (!organization || !scope || !widgets || !settings)
    return (
      <div className="grid min-h-80 place-items-center">
        <BlobLoader />
      </div>
    );
  const candidates = [
    ...new Map(
      [...results, ...(active?.draftTestimonials ?? [])].map((item) => [
        item.testimonialId,
        item,
      ]),
    ).values(),
  ];
  return (
    <StudioView
      brandName={organization.name}
      accentColor={settings.accentColor}
      attributionRequired={!settings.canHideAttribution}
      widgets={widgets}
      active={active ?? null}
      loadingActive={!!activeId && !active}
      candidates={candidates}
      hasMore={status === "CanLoadMore"}
      loadingMore={status === "LoadingMore"}
      onLoadMore={() => loadMore(20)}
      onOpen={setActiveId}
      origin={env.configured ? env.siteUrl.replace(/\/$/, "") : ""}
      inboxHref={`/org/${slug}/inbox`}
      onCreate={(name, config) => create({ ...scope, name, config })}
      onSave={async (id, draft, expectedRevision, shouldPublish) => {
        await save({
          ...scope,
          widgetId: id as Id<"widgets">,
          ...draft,
          testimonialIds: draft.testimonialIds as Id<"testimonials">[],
          expectedRevision,
          publish: shouldPublish,
        });
      }}
      onUnpublish={async (id) => {
        return await unpublish({ ...scope, widgetId: id as Id<"widgets"> });
      }}
      onRemove={async (id) => {
        await remove({ ...scope, widgetId: id as Id<"widgets"> });
      }}
    />
  );
}
