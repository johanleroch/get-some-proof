import { IconAlertCircle, IconTerminal2 } from "@tabler/icons-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SetupRequired({ missing }: { missing: string[] }) {
  return (
    <main className="bg-paper grid min-h-svh place-items-center px-6 py-16">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="bg-warning-soft text-warning mb-3 flex size-11 items-center justify-center rounded-md">
            <IconAlertCircle aria-hidden="true" className="size-5" />
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
            <ul className="text-ink-2 space-y-1 font-mono text-sm">
              {missing.map((variable) => (
                <li key={variable}>{variable}</li>
              ))}
            </ul>
          </div>
          <div className="bg-surface-2 rounded-md border p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <IconTerminal2 aria-hidden="true" className="size-4" />
              Next step
            </p>
            <code className="text-ink-2 mt-2 block text-sm">
              cp .env.example .env.local &amp;&amp; pnpm dev:convex
            </code>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
