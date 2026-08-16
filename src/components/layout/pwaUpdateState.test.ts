import { describe, expect, it } from "vitest";
import { resolvePwaPromptState } from "./pwaUpdateState";

describe("PWA prompt state", () => {
  it("keeps updates explicit and gives them priority over the ready notice", () => {
    expect(resolvePwaPromptState(false, false)).toBe("hidden");
    expect(resolvePwaPromptState(true, false)).toBe("offline-ready");
    expect(resolvePwaPromptState(true, true)).toBe("update-available");
  });
});
