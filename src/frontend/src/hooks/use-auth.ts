import { AuthContext, type AuthContextValue } from "@/context/AuthContext";
import { useContext } from "react";

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
