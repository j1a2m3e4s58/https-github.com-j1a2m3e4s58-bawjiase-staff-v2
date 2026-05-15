import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "bcb_agm_active_year";

interface AgmYearContextValue {
  activeYear: string;
  setActiveYear: (year: string) => void;
  yearOptions: string[];
}

const AgmYearContext = createContext<AgmYearContextValue | null>(null);

function getDefaultYear() {
  return String(new Date().getFullYear());
}

export function AgmYearProvider({ children }: { children: React.ReactNode }) {
  const [activeYear, setActiveYearState] = useState(() => {
    if (typeof window === "undefined") return getDefaultYear();
    return window.localStorage.getItem(STORAGE_KEY) ?? getDefaultYear();
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, activeYear);
  }, [activeYear]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = new Set<string>();
    for (let year = currentYear - 2; year <= currentYear + 6; year += 1) {
      years.add(String(year));
    }
    years.add(activeYear);
    return [...years].sort((a, b) => Number(a) - Number(b));
  }, [activeYear]);

  const value = useMemo(
    () => ({
      activeYear,
      setActiveYear: setActiveYearState,
      yearOptions,
    }),
    [activeYear, yearOptions],
  );

  return <AgmYearContext.Provider value={value}>{children}</AgmYearContext.Provider>;
}

export function useAgmYear() {
  const context = useContext(AgmYearContext);
  if (!context) {
    throw new Error("useAgmYear must be used within AgmYearProvider");
  }
  return context;
}
