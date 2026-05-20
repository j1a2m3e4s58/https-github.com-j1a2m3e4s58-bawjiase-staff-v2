import { Layout } from "@/components/Layout";
import { AgmYearSwitcher } from "@/components/AgmYearSwitcher";
import { useAgmYear } from "@/context/AgmYearContext";
import { storage, type ImportFileLibraryItem } from "@/lib/storage";
import { useState } from "react";
import { Step1Upload } from "./import/Step1Upload";
import { Step2Mapping } from "./import/Step2Mapping";
import { Step3Validate } from "./import/Step3Validate";
import { Step4Import } from "./import/Step4Import";
import { StepIndicator } from "./import/StepIndicator";
import type { ColumnMapping, MappedRow, ParsedRow } from "./import/types";
import { autoDetectMapping } from "./import/types";

export default function ImportPage() {
  const { activeYear } = useAgmYear();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    shareholderNumber: "",
    fullName: "",
    idNumber: "",
    email: "",
    phone: "",
    shareholding: "",
  });
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([]);
  const [validRows, setValidRows] = useState<MappedRow[]>([]);
  const [importFiles, setImportFiles] = useState<ImportFileLibraryItem[]>(
    storage.getImportFileLibrary,
  );

  function handleCatalogChange(nextItems: ImportFileLibraryItem[]) {
    setImportFiles(nextItems);
    storage.setImportFileLibrary(nextItems);
  }

  function handleStep1(f: File, hs: string[], rs: ParsedRow[]) {
    setFile(f);
    const now = new Date().toISOString();
    const existing = importFiles.find(
      (item) => item.name.toLowerCase() === f.name.toLowerCase(),
    );
    const nextItem: ImportFileLibraryItem = existing
      ? {
          ...existing,
          size: f.size,
          type: f.type,
          updatedAt: now,
          lastImportedAt: now,
        }
      : {
          id: `${f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
          name: f.name,
          size: f.size,
          type: f.type,
          addedAt: now,
          updatedAt: now,
          lastImportedAt: now,
        };
    handleCatalogChange([
      nextItem,
      ...importFiles.filter((item) => item.id !== nextItem.id),
    ]);
    setHeaders(hs);
    setRows(rs);
    setMapping(autoDetectMapping(hs));
    setStep(2);
  }

  function handleStep2(mapped: MappedRow[]) {
    setMappedRows(mapped);
    setStep(3);
  }

  function handleStep3(valid: MappedRow[]) {
    setValidRows(valid);
    setStep(4);
  }

  function handleReset() {
    setStep(1);
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMappedRows([]);
    setValidRows([]);
    setMapping({
      shareholderNumber: "",
      fullName: "",
      idNumber: "",
      email: "",
      phone: "",
      shareholding: "",
    });
  }

  const stepTitles = [
    "Upload File",
    "Map Columns",
    "Validate & Dedupe",
    "Import",
  ];
  const stepDescs = [
    "Select your Excel or CSV shareholder file",
    "Match file columns to shareholder fields",
    "Review errors and duplicate entries",
    "Import shareholders into the system",
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5" data-ocid="import.page">
        {/* Page header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Import Shareholders
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {stepDescs[step - 1]}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Imports are being tracked for AGM {activeYear}, so batch history and yearly administration stay separate.
            </p>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[160px]">
            <AgmYearSwitcher compact />
          </div>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Step card */}
        <div className="bg-card border border-border p-4 sm:p-6 lg:p-8 overflow-hidden">
          <div className="mb-6">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">
              Step {step} of 4
            </p>
            <h2 className="font-display text-lg font-semibold text-foreground mt-0.5">
              {stepTitles[step - 1]}
            </h2>
          </div>

          {step === 1 && (
            <Step1Upload
              onNext={handleStep1}
              importFiles={importFiles}
              onImportFilesChange={handleCatalogChange}
            />
          )}
          {step === 2 && (
            <Step2Mapping
              headers={headers}
              rows={rows}
              mapping={mapping}
              onMappingChange={setMapping}
              onBack={() => setStep(1)}
              onNext={handleStep2}
            />
          )}
          {step === 3 && (
            <Step3Validate
              mappedRows={mappedRows}
              onBack={() => setStep(2)}
              onNext={handleStep3}
            />
          )}
          {step === 4 && file && (
            <Step4Import
              agmYear={activeYear}
              validRows={validRows}
              filename={file.name}
              onBack={() => setStep(3)}
              onReset={handleReset}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}
