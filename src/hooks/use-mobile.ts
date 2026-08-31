import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  return useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("resize", onStoreChange);
      return () => window.removeEventListener("resize", onStoreChange);
    },
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  );
}
