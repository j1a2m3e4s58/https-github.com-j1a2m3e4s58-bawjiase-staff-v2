import { createContext, useMemo, type ReactNode } from "react";
import { useAgmAuth } from "@/store/agm-auth";

export type UserRole =
  | "Viewer"
  | "RegistrationOfficer"
  | "ReportsViewer"
  | "BoardViewer"
  | "Admin"
  | "SuperAdmin";

export interface AppUser {
  principal: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  passwordHash: string;
  createdAt: bigint;
  mustChangePassword: boolean;
  phoneNumber?: string;
  isPhoneVerified?: boolean;
}

export interface AuthContextValue {
  user: AppUser | null;
  sessionToken: string | null;
  isLoading: boolean;
  mustChangePassword: boolean;
  requiresPhoneVerification: boolean;
  verificationPhoneNumber: string;
  login: (
    username: string,
    password: string,
  ) => Promise<{ mustChangePassword: boolean; requiresPhoneVerification: boolean }>;
  refreshFirstTimeVerification: () => Promise<null>;
  completeFirstTimeVerification: (phoneNumber: string, tokenCode: string) => Promise<void>;
  completePasswordChange: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const agmAuth = useAgmAuth();

  const user = agmAuth.session
    ? ({
        principal: "",
        username: agmAuth.session.username,
        role: agmAuth.session.role,
        isActive: true,
        passwordHash: "",
        createdAt: BigInt(0),
        mustChangePassword: agmAuth.session.mustChangePassword,
        phoneNumber: "",
        isPhoneVerified: true,
      } satisfies AppUser)
    : null;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      sessionToken: agmAuth.session?.token ?? null,
      isLoading: agmAuth.isLoading,
      mustChangePassword: agmAuth.mustChangePassword,
      requiresPhoneVerification: false,
      verificationPhoneNumber: "",
      login: async (username, password) => {
        const result = await agmAuth.login(username, password);
        return {
          mustChangePassword: result.mustChangePassword,
          requiresPhoneVerification: false,
        };
      },
      refreshFirstTimeVerification: async () => null,
      completeFirstTimeVerification: async () => {},
      completePasswordChange: async () => {
        agmAuth.markPasswordUpdated();
      },
      logout: agmAuth.logout,
    }),
    [agmAuth, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
