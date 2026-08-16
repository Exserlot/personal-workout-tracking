import { describe, expect, it } from "vitest";
import { normalizeNumberInputValue } from "./numberInput";

describe("normalizeNumberInputValue", () => {
  it.each([
    ["08", "8"],
    ["0180", "180"],
    ["00008", "8"],
    ["00.5", "0.5"],
    ["0.5", "0.5"],
    ["0", "0"],
    ["", ""],
    ["-08", "-8"],
  ])("normalizes %s to %s", (value, expected) => {
    expect(normalizeNumberInputValue(value)).toBe(expected);
  });
});
