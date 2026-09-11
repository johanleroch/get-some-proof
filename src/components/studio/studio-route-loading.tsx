"use client";

import { defaultPrimaryColor } from "@convex/domain/brand";

import { useProjectShell } from "@/components/organizations/project-shell-context";
import { StudioView } from "@/components/studio/studio-view";

const stillLoading = () =>
  Promise.reject(new Error("Studio is still loading."));

export function StudioRouteLoading() {
  const project = useProjectShell();

  return (
    <StudioView
      accentColor={defaultPrimaryColor}
      active={null}
      attributionRequired
      brandName={project?.brandName ?? ""}
      candidates={[]}
      hasMore={false}
      inboxHref={project ? `/org/${project.slug}/inbox` : "/dashboard"}
      loading
      loadingMore={false}
      onCreate={stillLoading}
      onLoadMore={() => undefined}
      onOpen={() => undefined}
      onRemove={stillLoading}
      onSave={stillLoading}
      onUnpublish={stillLoading}
      origin=""
      widgets={[]}
    />
  );
}
