const GHANA_CARD_PATTERN = /^GHA-\d{9}-\d$/i;
const GHANA_PHONE_PATTERN = /^(?:\+233|0)\d{9}$/;

export function validateGhanaCardId(value: string): boolean {
  return GHANA_CARD_PATTERN.test(value.trim());
}

export function validateGhanaPhone(value: string): boolean {
  return GHANA_PHONE_PATTERN.test(value.trim().replace(/\s+/g, ""));
}

export function normalizePhone(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

export function buildRegistrationNotes(
  lines: Array<[label: string, value: string]>,
): string {
  return lines.map(([label, value]) => `${label}: ${value}`).join("\n");
}
