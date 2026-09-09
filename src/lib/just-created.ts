/**
 * Hands the moment of creation from the onboarding form to the first
 * Overview: the form marks it before it navigates, the Overview reads it
 * once, greets the Owner and clears it, so a reload never repeats the
 * greeting. Session storage keeps it to this tab and this visit.
 */
export type CreatedNoun = "Brand" | "project";

const storageKey = "get-some-proof-just-created";

export function markJustCreated(noun: CreatedNoun) {
  try {
    sessionStorage.setItem(storageKey, noun);
  } catch {
    // Without storage there is no greeting, and nothing else is lost.
  }
}

export function readJustCreated(): CreatedNoun | null {
  try {
    const value = sessionStorage.getItem(storageKey);
    return value === "Brand" || value === "project" ? value : null;
  } catch {
    return null;
  }
}

export function clearJustCreated() {
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    // Nothing to clear.
  }
}

/** For `useSyncExternalStore`: the flag changes only through this tab's own code. */
export function subscribeToNothing() {
  return () => undefined;
}
