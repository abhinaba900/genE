"use client";
import { useSyncExternalStore } from "react";

/** SSR-safe media query hook. Returns `false` on the server and first paint. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const usePrefersReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

/** True when the visitor has asked to save data (Save-Data / slow 2G) or prefers reduced data. */
export function useSaveData() {
  const reducedData = useMediaQuery("(prefers-reduced-data: reduce)");
  return useSyncExternalStore(
    () => () => {},
    () => {
      const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
      return reducedData || !!conn?.saveData || conn?.effectiveType === "slow-2g" || conn?.effectiveType === "2g";
    },
    () => false,
  );
}
