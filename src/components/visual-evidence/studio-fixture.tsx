"use client";
import { type ReactNode, useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import {
  StudioView,
  type StudioWidget,
  type StudioCandidate,
} from "@/components/studio/studio-view";
import { initialWidgetConfig } from "@/components/studio/catalog";

import { StudioWorkspaceShell } from "@/components/app-shell";

import { WorkspacePageShell } from "./instant-page-shells-fixture";

/** Exported so a development page can render the real widget on real cards. */
export const primaryStudioCandidates: StudioCandidate[] = [
  {
    testimonialId: "maya",
    card: {
      id: "maya",
      source: {
        platform: "google",
        url: "https://www.google.com/maps/reviews/1",
      },
      type: "text",
      name: "Maya Laurent",
      company: "Atelier June",
      role: "Founder",
      avatarUrl: null,
      publishedAt: 1,
      images: [
        {
          id: "studio-image" as Id<"testimonialImages">,
          url: "/brand/testimonial-sample.svg",
        },
      ],
      rating: 5,
      text: "Our customers finally have a place to tell their stories. Setup took ten minutes and the first testimonial arrived that afternoon.",
      richText: [
        {
          type: "p",
          children: [
            {
              text: "Our customers finally have a place to tell their stories.",
              highlight: true,
              href: "https://example.com/customer-story",
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
    testimonialId: "remy",
    card: {
      id: "remy",
      type: "video",
      name: "Remy Jupille",
      company: "RemyWeb Agency",
      role: "Founder",
      avatarUrl: null,
      publishedAt: 2,
      aspectRatio: "9:16",
      captionsAvailable: false,
      playbackId: "L2fsVjRn3fpD7OcP34HAZ7BIB99RlIUjgt4zaw3UW3Y",
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
const studioCandidates: StudioCandidate[] = [
  ...primaryStudioCandidates,
  ...Array.from({ length: 51 }, (_, index) => ({
    testimonialId: `extra-${index}`,
    card: {
      id: `extra-${index}`,
      type: "text" as const,
      name: `Customer ${index + 1}`,
      company: "Example Company",
      avatarUrl: null,
      publishedAt: index + 10,
      text: `A concise testimonial used to verify selection capacity ${index + 1}.`,
    },
  })),
];
function cards(ids: string[]) {
  return ids.flatMap((id) => {
    const found = primaryStudioCandidates.find(
      (candidate) => candidate.testimonialId === id,
    );
    return found ? [found] : [];
  });
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/**
 * Offsets from the moment the page renders, not a fixed date: the card says
 * "2 hours ago" at every capture, which is what has to stay stable, while a
 * frozen calendar date would drift into "3 months ago" and then change again.
 */
const NOW = Date.now();

const seed: StudioWidget = {
  _id: "fixture-widget",
  name: "Homepage proof",
  publicId: "12345678-1234-4234-8234-123456789abc",
  revision: 0,
  updatedAt: NOW - 2 * HOUR,
  draft: {
    config: initialWidgetConfig,
    testimonialIds: ["maya", "james", "sarah"],
  },
  cardTestimonials: cards(["maya", "james", "sarah"]),
};

/** The grid needs more than one widget, and every state it can be in. */
const gallery: StudioWidget[] = [
  seed,
  {
    _id: "fixture-widget-pricing",
    name: "Pricing page faces",
    publicId: "12345678-1234-4234-8234-1234567890ab",
    revision: 3,
    published: { config: initialWidgetConfig, testimonialIds: ["maya"] },
    publishedAt: NOW - 21 * DAY,
    updatedAt: NOW - 21 * DAY,
    draft: {
      config: { ...initialWidgetConfig, layout: "avatars" },
      testimonialIds: ["maya", "james", "sarah", "remy", "alex"],
    },
    cardTestimonials: cards(["maya", "james", "sarah", "remy"]),
  },
  {
    _id: "fixture-widget-hero",
    name: "Landing hero quote",
    publicId: "12345678-1234-4234-8234-1234567890cd",
    revision: 1,
    updatedAt: NOW - 4 * HOUR,
    draft: {
      config: { ...initialWidgetConfig, layout: "individual" },
      testimonialIds: ["remy"],
    },
    cardTestimonials: cards(["remy"]),
  },
  {
    _id: "fixture-widget-cases",
    name: "Case studies band",
    publicId: "12345678-1234-4234-8234-1234567890ef",
    revision: 7,
    published: { config: initialWidgetConfig, testimonialIds: ["maya"] },
    publishedAt: NOW - 6 * DAY,
    updatedAt: NOW - 3 * HOUR,
    draft: {
      config: { ...initialWidgetConfig, layout: "carousel" },
      testimonialIds: ["james", "sarah", "alex"],
    },
    cardTestimonials: cards(["james", "sarah", "alex"]),
  },
];
export function StudioFixture({
  editor = false,
  choosing = false,
  preview = false,
}: {
  editor?: boolean;
  choosing?: boolean;
  preview?: boolean;
}) {
  const [fonts, setFonts] = useState<
    Array<{ id: string; name: string; url: string }>
  >([]);
  const [candidateCount, setCandidateCount] = useState(4);
  const [widgets, setWidgets] = useState<StudioWidget[]>(gallery);
  const [activeId, setActiveId] = useState<string | null>(
    editor ? seed._id : null,
  );
  const shell = activeId
    ? (children: ReactNode) => (
        <StudioWorkspaceShell>{children}</StudioWorkspaceShell>
      )
    : (children: ReactNode) => (
        <WorkspacePageShell pathname="/org/atrakt/studio">
          {children}
        </WorkspacePageShell>
      );
  return shell(
    <>
      <StudioView
        fontLibrary={{ canUpload: true, fonts }}
        onUploadFont={async (file) => {
          const id = `fixturefont${fonts.length + 1}`;
          setFonts((current) => [
            ...current,
            {
              id,
              name: file.name.replace(/\.woff2$/i, ""),
              url: URL.createObjectURL(file),
            },
          ]);
          return id;
        }}
        onRemoveFont={async (id) => {
          const font = fonts.find((font) => font.id === id);
          if (font) URL.revokeObjectURL(font.url);
          setFonts((current) => current.filter((font) => font.id !== id));
        }}
        initialChoosing={choosing}
        initialPreview={preview}
        brandName="Cedar Workshop"
        accentColor="#ffbb16"
        attributionRequired={false}
        widgets={widgets}
        active={widgets.find((item) => item._id === activeId) ?? null}
        candidates={studioCandidates.slice(0, candidateCount)}
        hasMore={candidateCount < studioCandidates.length}
        loadingMore={false}
        onLoadMore={() => setCandidateCount(studioCandidates.length)}
        onOpen={setActiveId}
        inboxHref="/visual-evidence/testimonial-inbox"
        projectHref="/visual-evidence/dashboard"
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
    </>,
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
