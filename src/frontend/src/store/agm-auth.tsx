import { createActor } from "@/backend";
import { createActorWithConfig } from "@caffeineai/core-infrastructure";
import { buildAgmAuthClient, type AgmLoginResult, type AgmRole } from "@/lib/agm-auth-client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface AgmAuthSession {
  token: string;
  username: string;
  role: AgmRole;
  mustChangePassword: boolean;
  expiresAt?: string;
}

interface AgmAuthContextValue {
  session: AgmAuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  login: (username: string, password: string) => Promise<AgmLoginResult>;
  logout: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  resetPassword: (
    username: string,
    resetCode: string,
    newPassword: string,
  ) => Promise<void>;
  markPasswordUpdated: () => void;
}

const AGM_AUTH_KEY = "bcb_agm_auth_session";

const AgmAuthContext = createContext<AgmAuthContextValue | null>(null);

function readStoredSession(): AgmAuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AGM_AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AgmAuthSession;
  } catch {
    return null;
  }
}

function writeStoredSession(session: AgmAuthSession | null) {
  if (typeof window === "undefined") return;
  try {
    if (session) {
      window.localStorage.setItem(AGM_AUTH_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(AGM_AUTH_KEY);
    }
  } catch {
    // ignore storage failures
  }
}

export function AgmAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AgmAuthSession | null>(() => readStoredSession());
  const [isLoading, setIsLoading] = useState(true);
  const [actor, setActor] = useState<ReturnType<typeof createActor> | null>(null);
  const actorRef = useRef<ReturnType<typeof createActor> | null>(null);

  useEffect(() => {
    let cancelled = false;
    createActorWithConfig(createActor)
      .then((nextActor) => {
        if (!cancelled) {
          setActor(nextActor);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActor(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    actorRef.current = actor;
  }, [actor]);

  const clearSession = useCallback(() => {
    setSession(null);
    writeStoredSession(null);
  }, []);

  useEffect(() => {
    const current = readStoredSession();
    if (!current) {
      setIsLoading(false);
      return;
    }
    if (!actor) {
      setSession(current);
      setIsLoading(false);
      return;
    }
    const client = buildAgmAuthClient(actor);
    client
      .validateSession(current.token)
      .then((validated) => {
        const nextSession: AgmAuthSession = {
          token: validated.token,
          username: validated.username,
          role: validated.role,
          mustChangePassword: current.mustChangePassword,
          expiresAt: validated.expiresAt.toString(),
        };
        setSession(nextSession);
        writeStoredSession(nextSession);
      })
      .catch(() => {
        clearSession();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [actor, clearSession]);

  const requireClient = useCallback(() => {
    if (!actorRef.current) {
      throw new Error("AGM backend not ready");
    }
    return buildAgmAuthClient(actorRef.current);
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const client = requireClient();
      const result = await client.login(username, password);
      const nextSession: AgmAuthSession = {
        token: result.token,
        username: result.username,
        role: result.role,
        mustChangePassword: result.mustChangePassword,
      };
      setSession(nextSession);
      writeStoredSession(nextSession);
      return result;
    },
    [requireClient],
  );

  const logout = useCallback(async () => {
    const current = readStoredSession();
    try {
      if (current?.token && actorRef.current) {
        const client = buildAgmAuthClient(actorRef.current);
        await client.logout(current.token);
      }
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string) => {
      const current = readStoredSession();
      if (!current?.token) {
        throw new Error("AGM session not found");
      }
      const client = requireClient();
      await client.changePassword(current.token, oldPassword, newPassword);
      const nextSession = {
        ...current,
        mustChangePassword: false,
      };
      setSession(nextSession);
      writeStoredSession(nextSession);
    },
    [requireClient],
  );

  const resetPassword = useCallback(
    async (username: string, resetCode: string, newPassword: string) => {
      const client = requireClient();
      await client.resetPassword(username, resetCode, newPassword);
    },
    [requireClient],
  );

  const markPasswordUpdated = useCallback(() => {
    setSession((current) => {
      if (!current) return current;
      const nextSession = { ...current, mustChangePassword: false };
      writeStoredSession(nextSession);
      return nextSession;
    });
  }, []);

  const value = useMemo<AgmAuthContextValue>(
    () => ({
      session,
      isLoading,
      isAuthenticated: !!session?.token,
      mustChangePassword: !!session?.mustChangePassword,
      login,
      logout,
      changePassword,
      resetPassword,
      markPasswordUpdated,
    }),
    [changePassword, isLoading, login, logout, markPasswordUpdated, resetPassword, session],
  );

  return (
    <AgmAuthContext.Provider value={value}>{children}</AgmAuthContext.Provider>
  );
}

export function useAgmAuth() {
  const context = useContext(AgmAuthContext);
  if (!context) {
    throw new Error("useAgmAuth must be used within AgmAuthProvider");
  }
  return context;
}
