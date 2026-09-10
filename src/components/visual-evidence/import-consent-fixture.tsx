"use client";
import { useState } from "react";
import { ImportConsentView } from "@/components/chatgpt/import-authorization";

export function ImportConsentFixture({ paid = true }: { paid?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <main className="bg-paper text-ink grid min-h-svh place-items-center p-5 md:p-8">
      <div className="w-full max-w-lg">
        <ImportConsentView
          client={{ name: "Codex CLI" }}
          session={{
            user: { email: "maya@juniper.example", emailVerified: true },
          }}
          connection={{ paid, activated: false }}
          scopes={["testimonials:import:assistant", "offline_access"]}
          error={error}
          pending={null}
          respond={async () =>
            setError(
              "This request may have expired. Return to your assistant and try connecting again.",
            )
          }
        />
      </div>
    </main>
  );
}
export function ImportConsentFreeFixture() {
  return <ImportConsentFixture paid={false} />;
}
