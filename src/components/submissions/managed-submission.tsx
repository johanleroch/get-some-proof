"use client";

import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type ManagedSubmissionValue = {
  brandName: string;
  company?: string;
  moderationStatus: "pending" | "published" | "archived" | "spam";
  role?: string;
  submitterEmail: string;
  submitterName: string;
  text: string;
};

export function ManagedSubmissionView({
  submission,
}: {
  submission: ManagedSubmissionValue;
}) {
  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <p className="text-muted-foreground text-sm font-medium">
          {submission.brandName}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Your testimonial
        </h1>
        <p className="text-muted-foreground text-sm">
          Status:{" "}
          <span className="capitalize">{submission.moderationStatus}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <blockquote className="bg-muted/30 rounded-xl border p-4 text-sm leading-6">
          “{submission.text}”
        </blockquote>
        <div className="text-sm">
          <p className="font-medium">{submission.submitterName}</p>
          {submission.role || submission.company ? (
            <p className="text-muted-foreground">
              {[submission.role, submission.company]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          <p className="text-muted-foreground mt-2">
            Private email: {submission.submitterEmail}
          </p>
        </div>
        <p className="text-muted-foreground text-xs leading-5">
          Keep this private link. It will remain the secure way to manage this
          testimonial.
        </p>
      </CardContent>
    </Card>
  );
}

export function ManagedSubmission({ token }: { token: string }) {
  const submission = useQuery(api.submissions.getByManagementToken, { token });

  if (submission === undefined) {
    return <p className="text-muted-foreground text-sm">Loading submission…</p>;
  }
  if (submission === null) {
    return (
      <Card className="w-full max-w-xl text-center">
        <CardHeader>
          <h1 className="text-2xl font-semibold">Private link unavailable</h1>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          This management link is invalid or no longer active.
        </CardContent>
      </Card>
    );
  }

  return <ManagedSubmissionView submission={submission} />;
}
