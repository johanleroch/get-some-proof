"use client";

import {
  IconArrowRight,
  IconBuildingStore,
  IconLock,
  IconRefresh,
  IconUnlink,
  IconUserCircle,
} from "@tabler/icons-react";
import { Sparkle } from "@/components/doodles";
import { Stars } from "@/components/templates/template-primitives";
import { sourceIcons } from "./source-icons";
import { GoogleNotificationsView } from "./google-business-notifications-view";
import { ReviewList } from "../review-connectors/review-list";
import { Button } from "@/components/ui/button";

export type GooglePage = {
  items: {
    name: string;
    title: string;
    comment?: string;
    rating?: string;
    updatedAt?: string;
  }[];
  nextPageToken: string | null;
  totalReviewCount?: number;
  averageRating?: number;
};
export type GoogleViewProps = {
  notificationsConfigured?: boolean;
  notifications?: {
    account: string;
    location: string;
    revision: number;
    lastEventAt: number | null;
  } | null;
  onEnableNotifications?: () => void;
  onDisableNotifications?: () => void;
  configured: boolean;
  connected: boolean;
  busy: boolean;
  account?: string;
  location?: string;
  page: GooglePage | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onRead: (account?: string, location?: string, pageToken?: string) => void;
};

export function GoogleBusinessView({
  notificationsConfigured = false,
  notifications,
  onEnableNotifications,
  onDisableNotifications,
  configured,
  connected,
  busy,
  account,
  location,
  page,
  onConnect,
  onDisconnect,
  onRead,
}: GoogleViewProps) {
  return (
    <section aria-labelledby="google-reviews-heading" className="grid gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span className="border-line bg-surface flex size-12 shrink-0 items-center justify-center rounded-lg border">
            <GoogleMark className="size-7" />
          </span>
          <div className="max-w-xl space-y-2">
            <h2 id="google-reviews-heading" className="type-heading">
              Google reviews
            </h2>
            <p className="text-muted-foreground text-sm">
              Connect a business you manage on Google and read its customer
              reviews here.
            </p>
            {connected && (
              <p className="type-small text-success flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="bg-success size-1.5 rounded-full"
                />
                Google connected
              </p>
            )}
          </div>
        </div>
        {connected ? (
          <Button variant="ghost" disabled={busy} onClick={onDisconnect}>
            <IconUnlink aria-hidden="true" size={20} stroke={1.75} />
            Disconnect Google
          </Button>
        ) : (
          <Button loading={busy} disabled={!configured} onClick={onConnect}>
            Connect Google Business Profile
          </Button>
        )}
      </div>
      {!configured && (
        <p role="status" className="text-muted-foreground text-sm">
          Google connection is not available yet. Your existing imports are
          still available.
        </p>
      )}
      <div className="bg-surface-2 text-ink-2 flex items-start gap-3 rounded-lg p-4">
        <IconLock
          aria-hidden="true"
          size={16}
          stroke={1.75}
          className="mt-0.5 shrink-0"
        />
        <p className="type-small max-w-prose">
          Reviews stay private here. Publishing Google reviews on your Wall is
          not available yet.
        </p>
      </div>
      {connected && (
        <>
          <div
            className={`grid gap-2 sm:flex sm:flex-wrap ${account ? "grid-cols-2" : "grid-cols-1"}`}
          >
            <Button loading={busy} onClick={() => onRead(account, location)}>
              <IconRefresh aria-hidden="true" size={20} stroke={1.75} />
              {page || account ? "Refresh" : "Choose a Google account"}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={onConnect}
              aria-label="Reconnect Google"
            >
              <span className="sm:hidden">Reconnect</span>
              <span className="hidden sm:inline">Reconnect Google</span>
            </Button>
            {account && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => onRead()}
                aria-label="Change account"
              >
                <IconUserCircle aria-hidden="true" size={20} stroke={1.75} />
                <span className="sm:hidden">Account</span>
                <span className="hidden sm:inline">Change account</span>
              </Button>
            )}
            {location && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => onRead(account)}
                aria-label="Change location"
              >
                <IconBuildingStore aria-hidden="true" size={20} stroke={1.75} />
                <span className="sm:hidden">Location</span>
                <span className="hidden sm:inline">Change location</span>
              </Button>
            )}
          </div>
          {account &&
            location &&
            onEnableNotifications &&
            onDisableNotifications && (
              <GoogleNotificationsView
                configured={notificationsConfigured}
                enabled={
                  notifications?.account === account &&
                  notifications.location === location
                }
                busy={busy}
                onEnable={onEnableNotifications}
                onDisable={onDisableNotifications}
              />
            )}
          {page && (
            <GoogleResults {...{ page, account, location, busy, onRead }} />
          )}
        </>
      )}
    </section>
  );
}

function GoogleResults({
  page,
  account,
  location,
  busy,
  onRead,
}: Pick<GoogleViewProps, "account" | "location" | "busy" | "onRead"> & {
  page: GooglePage;
}) {
  return (
    <div aria-live="polite" className="grid gap-4">
      <h3 className="type-subheading">
        {location
          ? "Customer reviews"
          : account
            ? "Choose a business location"
            : "Choose an account"}
      </h3>
      {location && page.totalReviewCount !== undefined && (
        <div className="border-line relative flex flex-wrap items-center gap-4 border-b pr-10 pb-6">
          {page.averageRating !== undefined && (
            <>
              <p className="type-kpi tabular-nums">
                {page.averageRating.toFixed(1)}
                <span className="type-small text-ink-2 ml-1">/ 5</span>
              </p>
              <div className="space-y-1">
                <span aria-hidden="true">
                  <Stars
                    rating={page.averageRating}
                    className="text-brand"
                    size={20}
                  />
                </span>
                <p className="type-small text-ink-2">
                  {page.totalReviewCount} reviews on Google
                </p>
              </div>
            </>
          )}
          {page.averageRating === undefined && (
            <p className="type-small text-ink-2">
              {page.totalReviewCount} reviews on Google
            </p>
          )}
          <Sparkle className="text-brand absolute top-1 right-0 size-8" />
        </div>
      )}
      {page.items.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {location
            ? "No reviews found for this location."
            : "No accessible results. Check that this Google account manages a verified business."}
        </p>
      )}
      {location ? (
        <ReviewList
          reviews={page.items.map((entry) => ({
            id: entry.name,
            author: entry.title,
            body: entry.comment,
            stars: ratingLabels[entry.rating ?? ""],
            updatedAt: entry.updatedAt,
          }))}
          source={
            <>
              <GoogleMark className="size-4" />
              Google
            </>
          }
        />
      ) : (
        <ul className="divide-border divide-y">
          {page.items.map((entry) => (
            <li key={entry.name} className="py-4">
              <Button
                variant="ghost"
                className="h-auto max-w-full text-left whitespace-normal"
                disabled={busy}
                onClick={() =>
                  account ? onRead(account, entry.name) : onRead(entry.name)
                }
              >
                {entry.title}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {page.nextPageToken && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => onRead(account, location, page.nextPageToken!)}
        >
          Next page
          <IconArrowRight aria-hidden="true" size={20} stroke={1.75} />
        </Button>
      )}
    </div>
  );
}

const ratingLabels: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

function GoogleMark({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className={className}
      dangerouslySetInnerHTML={{ __html: sourceIcons.google.markup }}
    />
  );
}
