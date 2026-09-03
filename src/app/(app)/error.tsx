"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="bg-muted/30 grid min-h-svh place-items-center px-6">
      <div className="bg-card max-w-md rounded-xl border p-8 text-center shadow-xs">
        <h1 className="text-2xl font-semibold">This screen could not load</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          Check your connection or permissions, then try again. No change was
          made.
        </p>
        <Button className="mt-5" onClick={reset} type="button">
          Try again
        </Button>
      </div>
    </main>
  );
}
