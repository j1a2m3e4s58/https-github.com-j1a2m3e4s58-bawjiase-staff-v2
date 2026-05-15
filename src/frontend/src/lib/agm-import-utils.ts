import * as XLSX from "xlsx";

export interface ParsedRow {
  [key: string]: string;
}

export interface MappedRow {
  shareholderNumber: string;
  fullName: string;
  idNumber: string;
  email: string;
  phone: string;
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

export interface ImportField {
  key: keyof ColumnMapping;
  label: string;
  required: boolean;
}

export interface ValidationIssue {
  row: number;
  message: string;
  rowData: MappedRow;
}

export interface DuplicateIssue {
  row: number;
  shareholderNumber: string;
  fullName: string;
  source: "file" | "existing";
}

export interface ValidationResult {
  validRows: MappedRow[];
  errors: ValidationIssue[];
  duplicates: DuplicateIssue[];
}

export interface AgmImportHistoryItem {
  id: string;
  filename: string;
  importedAt: string;
  importedRows: number;
  duplicateRows: number;
  errorRows: number;
  status: "Completed" | "Completed With Issues";
}

export const AGM_IMPORT_FIELDS: ImportField[] = [
  { key: "shareholderNumber", label: "Shareholder Number", required: true },
  { key: "fullName", label: "Full Name", required: true },
  { key: "idNumber", label: "ID Number", required: true },
  { key: "email", label: "Email", required: false },
  { key: "phone", label: "Phone", required: false },
  { key: "shareholding", label: "Shareholding", required: false },
];

export const EMPTY_COLUMN_MAPPING: ColumnMapping = {
  shareholderNumber: "",
  fullName: "",
  idNumber: "",
  email: "",
  phone: "",
  shareholding: "",
};

const FIELD_ALIASES: Record<keyof ColumnMapping, string[]> = {
  shareholderNumber: [
    "shareholder number",
    "shareholder no",
    "shareholder_no",
    "shareholder",
    "member no",
    "member number",
    "account number",
  ],
  fullName: ["full name", "fullname", "name", "member name", "shareholder name"],
  idNumber: [
    "id number",
    "ghana card",
    "ghana card id",
    "national id",
    "passport",
    "id no",
  ],
  email: ["email", "email address", "e-mail"],
  phone: ["phone", "phone number", "mobile", "telephone", "tel"],
  shareholding: [
    "shareholding",
    "shares",
    "shares held",
    "number of shares",
    "share count",
  ],
};

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/\r/g, "").trim());
}

export function parseCsvText(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text
    .split(/\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("The CSV file needs a header row and at least one data row.");
  }

  const headers = splitCsvLine(lines[0]).map((header, index) =>
    header || `Column ${index + 1}`,
  );

  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: ParsedRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });

  return { headers, rows };
}

function buildParsedRowsFromWorksheet(worksheet: XLSX.WorkSheet): {
  headers: string[];
  rows: ParsedRow[];
} {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
  });

  if (rows.length === 0) {
    throw new Error("The spreadsheet needs at least one data row.");
  }

  const headers = Object.keys(rows[0]).map((header, index) =>
    header || `Column ${index + 1}`,
  );

  const normalizedRows: ParsedRow[] = rows.map((row) => {
    const normalized: ParsedRow = {};
    headers.forEach((header) => {
      const value = row[header];
      normalized[header] = value === null || value === undefined ? "" : String(value);
    });
    return normalized;
  });

  return { headers, rows: normalizedRows };
}

export async function parseSpreadsheetFile(file: File): Promise<{
  headers: string[];
  rows: ParsedRow[];
}> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    const text = await file.text();
    return parseCsvText(text);
  }

  if (extension === "xlsx" || extension === "xls") {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {
      type: "array",
      dense: true,
      cellText: false,
    });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    if (!firstSheet) {
      throw new Error("The spreadsheet does not contain any readable sheets.");
    }

    return buildParsedRowsFromWorksheet(firstSheet);
  }

  throw new Error("Unsupported file type. Upload CSV, XLSX, or XLS files only.");
}

export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping = { ...EMPTY_COLUMN_MAPPING };

  for (const field of AGM_IMPORT_FIELDS) {
    const aliases = FIELD_ALIASES[field.key];
    const match = headers.find((header) => {
      const normalizedHeader = header.toLowerCase().trim();
      return aliases.some(
        (alias) =>
          normalizedHeader === alias || normalizedHeader.includes(alias),
      );
    });

    if (match) {
      mapping[field.key] = match;
    }
  }

  return mapping;
}

export function mapRow(row: ParsedRow, mapping: ColumnMapping): MappedRow {
  const shareholdingValue = mapping.shareholding
    ? Number.parseFloat((row[mapping.shareholding] ?? "0").replace(/,/g, ""))
    : 0;

  return {
    shareholderNumber: (row[mapping.shareholderNumber] ?? "").trim().toUpperCase(),
    fullName: (row[mapping.fullName] ?? "").trim(),
    idNumber: (row[mapping.idNumber] ?? "").trim().toUpperCase(),
    email: mapping.email ? (row[mapping.email] ?? "").trim() : "",
    phone: mapping.phone ? (row[mapping.phone] ?? "").trim() : "",
    shareholding: Number.isFinite(shareholdingValue) ? shareholdingValue : 0,
  };
}

export function validateMappedRows(
  rows: MappedRow[],
  existingShareholderNumbers: string[],
): ValidationResult {
  const validRows: MappedRow[] = [];
  const errors: ValidationIssue[] = [];
  const duplicates: DuplicateIssue[] = [];
  const seenNumbers = new Set<string>();
  const existingNumbers = new Set(
    existingShareholderNumbers.map((value) => value.trim().toUpperCase()),
  );

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const rowErrors: string[] = [];

    if (!row.shareholderNumber) rowErrors.push("Shareholder number is required.");
    if (!row.fullName) rowErrors.push("Full name is required.");
    if (!row.idNumber) rowErrors.push("ID number is required.");
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      rowErrors.push("Email format is invalid.");
    }
    if (row.shareholding < 0) {
      rowErrors.push("Shareholding cannot be negative.");
    }

    if (rowErrors.length > 0) {
      errors.push({
        row: rowNumber,
        message: rowErrors.join(" "),
        rowData: row,
      });
      return;
    }

    if (existingNumbers.has(row.shareholderNumber)) {
      duplicates.push({
        row: rowNumber,
        shareholderNumber: row.shareholderNumber,
        fullName: row.fullName,
        source: "existing",
      });
      return;
    }

    if (seenNumbers.has(row.shareholderNumber)) {
      duplicates.push({
        row: rowNumber,
        shareholderNumber: row.shareholderNumber,
        fullName: row.fullName,
        source: "file",
      });
      return;
    }

    seenNumbers.add(row.shareholderNumber);
    validRows.push(row);
  });

  return { validRows, errors, duplicates };
}

export function serializeErrorsToCsv(errors: ValidationIssue[]): string {
  const lines = [
    ["Row", "Message", "Shareholder Number", "Full Name", "ID Number"],
    ...errors.map((issue) => [
      String(issue.row),
      issue.message,
      issue.rowData.shareholderNumber,
      issue.rowData.fullName,
      issue.rowData.idNumber,
    ]),
  ];

  return lines
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
