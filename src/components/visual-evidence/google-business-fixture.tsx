"use client";
import { useState } from "react";
import { GoogleBusinessView } from "@/components/testimonials/google-business-view";

export function GoogleBusinessFixture() {
  const [connected, setConnected] = useState(true);
  const [updates, setUpdates] = useState(false);
  return (
    <main className="mx-auto w-full max-w-3xl p-6 md:p-10">
      <GoogleBusinessView
        configured
        notificationsConfigured
        notifications={
          updates
            ? {
                account: "accounts/123",
                location: "locations/456",
                revision: 0,
                lastEventAt: null,
              }
            : null
        }
        onEnableNotifications={() => setUpdates(true)}
        onDisableNotifications={() => setUpdates(false)}
        connected={connected}
        busy={false}
        account="accounts/123"
        location="locations/456"
        page={
          connected
            ? {
                items: [
                  {
                    name: "review-1",
                    title: "Camille Roche",
                    rating: "FIVE",
                    comment:
                      "Our pottery class at Willow Ceramics was such a lovely afternoon. Clear instructions, plenty of time to experiment, and a mug I'm proud to use every day.",
                  },
                  {
                    name: "review-2",
                    title: "Alex Martin",
                    rating: "FOUR",
                    comment:
                      "A welcoming studio and a patient teacher. Would happily book another workshop.",
                  },
                ],
                nextPageToken: "next",
                totalReviewCount: 62,
                averageRating: 4.8,
              }
            : null
        }
        onConnect={() => setConnected(true)}
        onDisconnect={() => setConnected(false)}
        onRead={() => {}}
      />
    </main>
  );
}
