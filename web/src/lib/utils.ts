import { useSyncExternalStore } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const onFullscreenChange = (cb: () => void) => {
  document.addEventListener("fullscreenchange", cb);
  return () => document.removeEventListener("fullscreenchange", cb);
};

/** Where overlays (menus, tooltips, dialogs) mount: inside the full-screen element when
 *  there is one, since only it is visible then; otherwise the body (undefined). */
export function useOverlayContainer(): HTMLElement | undefined {
  return (
    useSyncExternalStore(
      onFullscreenChange,
      () => document.fullscreenElement as HTMLElement | null,
      () => null,
    ) ?? undefined
  );
}
