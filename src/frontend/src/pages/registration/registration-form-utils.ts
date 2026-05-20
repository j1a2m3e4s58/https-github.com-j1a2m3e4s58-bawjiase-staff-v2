export function validateGhanaCardId(value: string): boolean {
  return /^GHA-\d{9}-\d$/i.test(value.trim());
}

export function validateGhanaPhone(value: string): boolean {
  return /^(?:\+233|0)\d{9}$/.test(value.trim().replace(/\s+/g, ""));
}

export function normalizePhone(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

export function buildRegistrationNotes(
  lines: Array<[label: string, value: string]>,
): string {
  return lines.map(([label, value]) => `${label}: ${value}`).join("\n");
}

export function parseRegistrationNotes(notes?: string): Record<string, string> {
  if (!notes) return {};
  return notes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) return accumulator;
      const label = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      if (label) {
        accumulator[label] = value;
      }
      return accumulator;
    }, {});
}

export function getDefaultAgmYear(): string {
  return new Date().getFullYear().toString();
}

export function getAgmYearOptions(rangeBefore = 2, rangeAfter = 6): string[] {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let year = currentYear - rangeBefore; year <= currentYear + rangeAfter; year += 1) {
    years.push(String(year));
  }
  return years;
}
