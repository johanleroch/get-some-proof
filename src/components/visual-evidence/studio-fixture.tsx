"use client";
import { useState } from "react";
import {
  StudioView,
  type StudioWidget,
  type StudioCandidate,
} from "@/components/studio/studio-view";
import { initialWidgetConfig } from "@/components/studio/catalog";

const studioCandidates: StudioCandidate[] = [
  {
    testimonialId: "maya",
    card: {
      id: "maya",
      type: "text",
      name: "Maya Laurent",
      company: "Atelier June",
      role: "Founder",
      avatarUrl: null,
      publishedAt: 1,
      rating: 5,
      text: "Our customers finally have a place to tell their stories. Setup took ten minutes and the first testimonial arrived that afternoon.",
      richText: [
        {
          type: "p",
          children: [
            {
              text: "Our customers finally have a place to tell their stories.",
              highlight: true,
            },
            {
              text: " Setup took ten minutes and the first testimonial arrived that afternoon.",
            },
          ],
        },
      ],
    },
  },
  {
    testimonialId: "james",
    card: {
      id: "james",
      type: "text",
      name: "James Carter",
      company: "Cedar Workshop",
      role: "Owner",
      avatarUrl: null,
      publishedAt: 2,
      rating: 5,
      text: "The proof speaks for itself. We added it beside our booking form and people started mentioning it on calls.",
      richText: [
        {
          type: "p",
          children: [
            { text: "The proof speaks for itself.", highlight: true },
            {
              text: " We added it beside our booking form and people started mentioning it on calls.",
            },
          ],
        },
      ],
    },
  },
  {
    testimonialId: "sarah",
    card: {
      id: "sarah",
      type: "text",
      name: "Sarah Reed",
      company: "Fernhill Studio",
      role: "Designer",
      avatarUrl: null,
      publishedAt: 3,
      text: "A small detail that made our website feel much more human. I love being able to choose the words our customers already use.",
      richText: [
        {
          type: "p",
          children: [
            {
              text: "A small detail that made our website feel much more human.",
              highlight: true,
            },
            {
              text: " I love being able to choose the words our customers already use.",
            },
          ],
        },
      ],
    },
  },
  {
    testimonialId: "alex",
    card: {
      id: "alex",
      type: "text",
      name: "Alex Thomas",
      company: "Field Notes",
      avatarUrl: null,
      avatarVisible: false,
      publishedAt: 4,
      text: "Simple, thoughtful and easy to keep up to date.",
    },
  },
];
const seed: StudioWidget = {
  _id: "fixture-widget",
  name: "Homepage proof",
  publicId: "12345678-1234-4234-8234-123456789abc",
  revision: 0,
  draft: {
    config: initialWidgetConfig,
    testimonialIds: ["maya", "james", "sarah"],
  },
};
export function StudioFixture({
  editor = false,
  choosing = false,
  preview = false,
}: {
  editor?: boolean;
  choosing?: boolean;
  preview?: boolean;
}) {
  const [widgets, setWidgets] = useState<StudioWidget[]>([seed]);
  const [activeId, setActiveId] = useState<string | null>(
    editor ? seed._id : null,
  );
  return (
    <StudioView
      initialChoosing={choosing}
      initialPreview={preview}
      brandName="Cedar Workshop"
      accentColor="#ffbb16"
      attributionRequired={false}
      widgets={widgets}
      active={widgets.find((item) => item._id === activeId) ?? null}
      candidates={studioCandidates}
      hasMore={false}
      loadingMore={false}
      onLoadMore={() => {}}
      onOpen={setActiveId}
      inboxHref="/visual-evidence/testimonial-inbox"
      origin="https://getsomeproof.example"
      onCreate={async (name, config) => {
        const id = `fixture-${widgets.length}`;
        setWidgets([
          ...widgets,
          {
            _id: id,
            name,
            publicId: `12345678-1234-4234-8234-${String(widgets.length).padStart(12, "0")}`,
            revision: 0,
            draft: { config, testimonialIds: [] },
          },
        ]);
        return id;
      }}
      onSave={async (id, draft, revision, publish) => {
        setWidgets(
          widgets.map((item) =>
            item._id === id
              ? {
                  ...item,
                  name: draft.name,
                  draft: {
                    config: draft.config,
                    testimonialIds: draft.testimonialIds,
                  },
                  revision: revision + 1,
                  ...(publish ? { published: { ...draft } } : {}),
                }
              : item,
          ),
        );
      }}
      onUnpublish={async (id) => {
        const nextRevision =
          (widgets.find((item) => item._id === id)?.revision ?? 0) + 1;
        setWidgets(
          widgets.map((item) =>
            item._id === id
              ? { ...item, published: undefined, revision: nextRevision }
              : item,
          ),
        );
        return nextRevision;
      }}
      onRemove={async (id) => {
        setWidgets(widgets.filter((item) => item._id !== id));
      }}
    />
  );
}
export function StudioEditorFixture() {
  return <StudioFixture editor />;
}

export function StudioTemplatesFixture() {
  return <StudioFixture choosing />;
}
export function StudioPreviewFixture() {
  return <StudioFixture editor preview />;
}
