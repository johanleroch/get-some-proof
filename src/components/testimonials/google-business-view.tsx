"use client";

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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl space-y-2">
          <h2 id="google-reviews-heading" className="type-heading">
            Google reviews
          </h2>
          <p className="text-muted-foreground text-sm">
            Connect a business you manage on Google and read its customer
            reviews here.
          </p>
        </div>
        {connected ? (
          <Button variant="outline" disabled={busy} onClick={onDisconnect}>
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
      <p className="text-muted-foreground text-sm">
        Reviews stay private here. Publishing Google reviews on your Wall is not
        available yet.
      </p>
      {connected && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              loading={busy}
              onClick={() => onRead(account, location)}
            >
              {" "}
              {page || account ? "Refresh" : "Choose a Google account"}{" "}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={onConnect}>
              Reconnect Google
            </Button>
            {account && (
              <Button variant="ghost" disabled={busy} onClick={() => onRead()}>
                Change account
              </Button>
            )}
            {location && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => onRead(account)}
              >
                Change location
              </Button>
            )}
          </div>
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
      <h3 className="font-semibold">
        {location
          ? "Customer reviews"
          : account
            ? "Choose a business location"
            : "Choose an account"}
      </h3>
      {location && page.totalReviewCount !== undefined && (
        <p className="text-muted-foreground text-sm">
          {page.totalReviewCount} reviews on Google
          {page.averageRating !== undefined
            ? ` · ${page.averageRating.toFixed(1)} out of 5`
            : ""}
        </p>
      )}
      {page.items.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {location
            ? "No reviews found for this location."
            : "No accessible results. Check that this Google account manages a verified business."}
        </p>
      )}
      <ul className="divide-border divide-y">
        {page.items.map((entry) => (
          <li key={entry.name} className="py-4">
            {location ? (
              <GoogleReview entry={entry} />
            ) : (
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
            )}
          </li>
        ))}
      </ul>
      {page.nextPageToken && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => onRead(account, location, page.nextPageToken!)}
        >
          Next page
        </Button>
      )}
    </div>
  );
}

const ratingLabels: Record<string, string> = {
  ONE: "1",
  TWO: "2",
  THREE: "3",
  FOUR: "4",
  FIVE: "5",
};
function GoogleReview({ entry }: { entry: GooglePage["items"][number] }) {
  const rating = ratingLabels[entry.rating ?? ""];
  return (
    <article className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{entry.title}</p>
        <p className="text-muted-foreground text-sm">
          {rating ? `${rating} / 5 · Google` : "Google review"}
        </p>
      </div>
      <p className="text-sm whitespace-pre-wrap">
        {entry.comment || "Rating only"}
      </p>
    </article>
  );
}
