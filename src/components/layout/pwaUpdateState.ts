export type PwaPromptState = "hidden" | "offline-ready" | "update-available";

export function resolvePwaPromptState(offlineReady: boolean, needRefresh: boolean): PwaPromptState {
  if (needRefresh) return "update-available";
  if (offlineReady) return "offline-ready";
  return "hidden";
}
