"use client";
import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { useSearchParams } from "next/navigation";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { defaultPrimaryColor } from "@convex/domain/brand";
import { useProjectShell } from "@/components/organizations/project-shell-context";
import { getPublicEnvironment } from "@/lib/env/public-env";
import {
  setStudioChoosingFilter,
  studioChoosingFromUrl,
} from "@/lib/studio-route-state";
import { StudioView } from "./studio-view";

export function Studio({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const activeId = searchParams.get("widget");
  const initialChoosing = studioChoosingFromUrl(searchParams);
  function setActiveId(id: string | null) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("widget", id);
    else url.searchParams.delete("widget");
    url.searchParams.delete("create");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }
  const projectShell = useProjectShell();
  const shellProject = projectShell?.slug === slug ? projectShell : null;
  const queriedOrganization = useQuery(
    api.organizations.getBySlug,
    shellProject ? "skip" : { slug },
  );
  const organization = shellProject
    ? {
        id: shellProject.organizationId,
        name: shellProject.brandName,
      }
    : queriedOrganization;
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
  const fontLibrary = useQuery(api.widgetFonts.list, scope ?? "skip");
  const uploadFont = useAction(api.widgetFonts.upload);
  const removeFont = useMutation(api.widgetFonts.remove);
  const create = useMutation(api.widgets.create);
  const save = useMutation(api.widgets.save);
  const unpublish = useMutation(api.widgets.unpublish);
  const remove = useMutation(api.widgets.remove);
  const env = getPublicEnvironment();
  if (organization === null) return <p className="p-8">Project unavailable.</p>;
  const loading =
    organization === undefined ||
    scope === null ||
    widgets === undefined ||
    settings === undefined;
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
      fontLibrary={fontLibrary}
      onUploadFont={async (file) => {
        if (!scope) throw new Error("Studio is still loading.");
        return await uploadFont({
          ...scope,
          name: file.name.replace(/\.woff2$/i, ""),
          bytes: await file.arrayBuffer(),
        });
      }}
      onRemoveFont={async (id) => {
        if (!scope) throw new Error("Studio is still loading.");
        await removeFont({ ...scope, fontId: id as Id<"widgetFonts"> });
      }}
      brandName={organization?.name ?? ""}
      accentColor={settings?.accentColor ?? defaultPrimaryColor}
      attributionRequired={settings ? !settings.canHideAttribution : true}
      widgets={widgets ?? []}
      active={active ?? null}
      loadingActive={!!activeId && active === undefined}
      loading={loading}
      loadingCandidates={status === "LoadingFirstPage"}
      candidates={candidates}
      hasMore={status === "CanLoadMore"}
      loadingMore={status === "LoadingMore"}
      initialChoosing={initialChoosing}
      onChoosingChange={setStudioChoosingFilter}
      onLoadMore={() => loadMore(20)}
      onOpen={setActiveId}
      origin={env.configured ? env.siteUrl.replace(/\/$/, "") : ""}
      inboxHref={`/org/${slug}/inbox`}
      projectHref={`/org/${slug}/dashboard`}
      onCreate={(name, config) => {
        if (!scope) throw new Error("Studio is still loading.");
        return create({ ...scope, name, config });
      }}
      onSave={async (id, draft, expectedRevision, shouldPublish) => {
        if (!scope) throw new Error("Studio is still loading.");
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
        if (!scope) throw new Error("Studio is still loading.");
        return await unpublish({ ...scope, widgetId: id as Id<"widgets"> });
      }}
      onRemove={async (id) => {
        if (!scope) throw new Error("Studio is still loading.");
        await remove({ ...scope, widgetId: id as Id<"widgets"> });
      }}
    />
  );
}
