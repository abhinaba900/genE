"use client";

import { useSyncExternalStore } from "react";

const VOLUME_KEY = "gen-e:volume";
export const DEFAULT_VOLUME = 0.8;

export const clampVolume = (v: number) => Math.min(1, Math.max(0, Math.round(v * 100) / 100));

/** The visitor's last chosen volume (shared by reels and article players). */
export function readStoredVolume(): number | null {
  try {
    const saved = Number(localStorage.getItem(VOLUME_KEY));
    return saved > 0 && saved <= 1 ? saved : null;
  } catch {
    return null;
  }
}

export function storeVolume(v: number) {
  try {
    if (v > 0) localStorage.setItem(VOLUME_KEY, String(v));
  } catch {}
}

/**
 * iOS Safari ignores `video.volume` (hardware buttons only), so volume sliders
 * are hidden there and controls fall back to a plain mute toggle.
 */
let volumeSupported: boolean | undefined;
export function useVolumeSupported() {
  return useSyncExternalStore(
    () => () => {},
    () => {
      if (volumeSupported === undefined) {
        const probe = document.createElement("video");
        probe.volume = 0.5;
        volumeSupported = probe.volume === 0.5;
      }
      return volumeSupported;
    },
    () => true,
  );
}
