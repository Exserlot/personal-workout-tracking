/** Keeps valid decimal zeroes while removing redundant integer leading zeroes. */
export function normalizeNumberInputValue(value: string) {
  return value.replace(/^(-?)0+(?=\d)/, "$1");
}

/** Normalizes the live DOM value as well as returning it for controlled state. */
export function readNumberInput(input: HTMLInputElement) {
  const normalized = normalizeNumberInputValue(input.value);
  if (normalized !== input.value) input.value = normalized;
  return normalized;
}
