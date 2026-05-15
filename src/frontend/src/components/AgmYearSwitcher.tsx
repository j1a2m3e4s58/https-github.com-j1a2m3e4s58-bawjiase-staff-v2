import { useAgmYear } from "@/context/AgmYearContext";

export function AgmYearSwitcher({ compact = false }: { compact?: boolean }) {
  const { activeYear, setActiveYear, yearOptions } = useAgmYear();

  return (
    <label className={compact ? "min-w-[102px]" : "min-w-[138px]"}>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        AGM Year
      </span>
      <select
        value={activeYear}
        onChange={(event) => setActiveYear(event.target.value)}
        className="control-sharp glass-input border-input h-11 w-full border bg-transparent px-3 text-sm font-semibold outline-none focus:border-primary"
      >
        {yearOptions.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </label>
  );
}
