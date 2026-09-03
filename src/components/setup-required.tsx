import { CircleAlert, Terminal } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SetupRequired({ missing }: { missing: string[] }) {
  return (
    <main className="bg-muted/30 grid min-h-svh place-items-center px-6 py-16">
      <Card className="w-full max-w-2xl shadow-xs">
        <CardHeader>
          <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <CircleAlert aria-hidden="true" className="size-5" />
          </div>
          <CardTitle>Finish your local setup</CardTitle>
          <CardDescription>
            The application is installed, but it still needs its public Convex
            configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium">Missing variables</p>
            <ul className="text-muted-foreground space-y-1 font-mono text-sm">
              {missing.map((variable) => (
                <li key={variable}>{variable}</li>
              ))}
            </ul>
          </div>
          <div className="border-border bg-background rounded-lg border p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Terminal aria-hidden="true" className="size-4" />
              Next step
            </p>
            <code className="text-muted-foreground mt-2 block text-sm">
              cp .env.example .env.local &amp;&amp; pnpm dev:convex
            </code>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
