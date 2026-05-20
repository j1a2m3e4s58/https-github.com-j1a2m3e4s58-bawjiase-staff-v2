import type { ShareholderInput } from "@/types";

export interface ParsedRow {
  [key: string]: string;
}

export interface MappedRow {
  shareholderNumber: string;
  fullName: string;
  idNumber: string;
  email?: string;
  phone?: string;
  shareholding: number;
}

export interface ColumnMapping {
  shareholderNumber: string;
  fullName: string;
  idNumber: string;
  email: string;
  phone: string;
  shareholding: string;
}

export interface ValidationResult {
  valid: MappedRow[];
  errors: Array<{
    row: number;
    field: string;
    message: string;
    data: MappedRow;
  }>;
  duplicates: Array<{
    row: number;
    shareholderNumber: string;
    data: MappedRow;
  }>;
}

export interface ImportResult {
  imported: number;
  duplicatesSkipped: number;
  errors: number;
  batchId: string;
}

export const TARGET_FIELDS = [
  {
    key: "shareholderNumber" as const,
    label: "Shareholder Number",
    required: true,
  },
  { key: "fullName" as const, label: "Full Name", required: true },
  { key: "idNumber" as const, label: "ID Number", required: true },
  { key: "email" as const, label: "Email", required: false },
  { key: "phone" as const, label: "Phone", required: false },
  { key: "shareholding" as const, label: "Shareholding", required: false },
];

export const FIELD_ALIASES: Record<keyof ColumnMapping, string[]> = {
  shareholderNumber: [
    "shareholder number",
    "shareholder no",
    "shareholder_no",
    "sh_no",
    "sh no",
    "number",
    "id",
    "member no",
    "member number",
  ],
  fullName: [
    "full name",
    "fullname",
    "name",
    "shareholder name",
    "member name",
    "full_name",
  ],
  idNumber: [
    "id number",
    "id_number",
    "id no",
    "national id",
    "national_id",
    "passport",
    "id",
  ],
  email: ["email", "email address", "e-mail"],
  phone: ["phone", "phone number", "mobile", "telephone", "tel", "cell"],
  shareholding: [
    "shareholding",
    "shares",
    "shares held",
    "number of shares",
    "share count",
    "units",
  ],
};

export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    shareholderNumber: "",
    fullName: "",
    idNumber: "",
    email: "",
    phone: "",
    shareholding: "",
  };

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const header of headers) {
      const normalized = header.toLowerCase().trim();
      if (aliases.some((a) => normalized === a || normalized.includes(a))) {
        mapping[field as keyof ColumnMapping] = header;
        break;
      }
    }
  }
  return mapping;
}

export function mapRow(row: ParsedRow, mapping: ColumnMapping): MappedRow {
  return {
    shareholderNumber: row[mapping.shareholderNumber]?.toString().trim() ?? "",
    fullName: row[mapping.fullName]?.toString().trim() ?? "",
    idNumber: row[mapping.idNumber]?.toString().trim() ?? "",
    email: mapping.email ? row[mapping.email]?.toString().trim() : undefined,
    phone: mapping.phone ? row[mapping.phone]?.toString().trim() : undefined,
    shareholding: mapping.shareholding
      ? Number.parseFloat(row[mapping.shareholding]?.toString() ?? "0") || 0
      : 0,
  };
}

export function validateRows(
  rows: MappedRow[],
  skipDuplicates: boolean,
): ValidationResult {
  const seen = new Set<string>();
  const valid: MappedRow[] = [];
  const errors: ValidationResult["errors"] = [];
  const duplicates: ValidationResult["duplicates"] = [];

  rows.forEach((row, i) => {
    const rowErrors: string[] = [];
    if (!row.shareholderNumber) rowErrors.push("shareholderNumber: required");
    if (!row.fullName) rowErrors.push("fullName: required");
    if (!row.idNumber) rowErrors.push("idNumber: required");
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))
      rowErrors.push("email: invalid format");

    if (rowErrors.length > 0) {
      errors.push({
        row: i + 1,
        field: rowErrors[0],
        message: rowErrors.join("; "),
        data: row,
      });
      return;
    }

    if (seen.has(row.shareholderNumber)) {
      duplicates.push({
        row: i + 1,
        shareholderNumber: row.shareholderNumber,
        data: row,
      });
      return;
    }
    seen.add(row.shareholderNumber);
    valid.push(row);
  });

  return { valid: skipDuplicates ? valid : valid, errors, duplicates };
}

export function toShareholderInput(row: MappedRow): ShareholderInput {
  return {
    shareholderNumber: row.shareholderNumber,
    fullName: row.fullName,
    idNumber: row.idNumber,
    ...(row.email ? { email: row.email } : {}),
    ...(row.phone ? { phone: row.phone } : {}),
    shareholding: BigInt(Math.round(row.shareholding)),
    tags: [],
  };
}
