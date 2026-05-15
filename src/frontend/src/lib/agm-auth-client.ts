import { createActor } from "@/backend";

export type AgmRole =
  | "Viewer"
  | "RegistrationOfficer"
  | "ReportsViewer"
  | "BoardViewer"
  | "Admin"
  | "SuperAdmin";

export interface AgmLoginResult {
  token: string;
  username: string;
  role: AgmRole;
  mustChangePassword: boolean;
}

export interface AgmSessionResult {
  token: string;
  username: string;
  role: AgmRole;
  expiresAt: bigint;
}

type ActorLike = ReturnType<typeof createActor>;

interface LocalAgmAuthUser {
  username: string;
  password: string;
  role: AgmRole;
  mustChangePassword: boolean;
}

const AGM_LOCAL_USERS_KEY = "bcb_agm_local_users";
const AGM_LOCAL_SESSION_PREFIX = "local-agm-session";
const AGM_LOCAL_RESET_PREFIX = "RST-";

function readLocalUsers(): LocalAgmAuthUser[] {
  if (typeof window === "undefined") {
    return [
      {
        username: "T4N4AMEG8F5",
        password: "T4N4AMEG8F5",
        role: "SuperAdmin",
        mustChangePassword: false,
      },
    ];
  }
  try {
    const raw = window.localStorage.getItem(AGM_LOCAL_USERS_KEY);
    if (!raw) {
      return [
        {
          username: "T4N4AMEG8F5",
          password: "T4N4AMEG8F5",
          role: "SuperAdmin",
          mustChangePassword: false,
        },
      ];
    }
    const parsed = JSON.parse(raw) as LocalAgmAuthUser[];
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : [
          {
            username: "T4N4AMEG8F5",
            password: "T4N4AMEG8F5",
            role: "SuperAdmin",
            mustChangePassword: false,
          },
        ];
  } catch {
    return [
      {
        username: "T4N4AMEG8F5",
        password: "T4N4AMEG8F5",
        role: "SuperAdmin",
        mustChangePassword: false,
      },
    ];
  }
}

function writeLocalUsers(users: LocalAgmAuthUser[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AGM_LOCAL_USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore storage failures
  }
}

export function buildLocalAgmAuthClient() {
  return {
    async login(username: string, password: string): Promise<AgmLoginResult> {
      const users = readLocalUsers();
      const user = users.find(
        (item) => item.username.trim().toLowerCase() === username.trim().toLowerCase(),
      );
      if (!user || user.password !== password) {
        throw new Error("Invalid AGM username or password");
      }
      return {
        token: `${AGM_LOCAL_SESSION_PREFIX}:${user.username}`,
        username: user.username,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      };
    },
    async validateSession(token: string): Promise<AgmSessionResult> {
      if (!token.startsWith(AGM_LOCAL_SESSION_PREFIX)) {
        throw new Error("Invalid AGM session");
      }
      const username = token.split(":").slice(1).join(":");
      const users = readLocalUsers();
      const user = users.find((item) => item.username === username);
      if (!user) {
        throw new Error("Invalid AGM session");
      }
      return {
        token,
        username: user.username,
        role: user.role,
        expiresAt: BigInt(Date.now() + 1000 * 60 * 60 * 8),
      };
    },
    async logout(_token: string): Promise<void> {},
    async changePassword(
      token: string,
      oldPassword: string,
      newPassword: string,
    ): Promise<void> {
      const username = token.split(":").slice(1).join(":");
      const users = readLocalUsers();
      const index = users.findIndex((item) => item.username === username);
      if (index < 0) {
        throw new Error("AGM session not found");
      }
      if (users[index].password !== oldPassword) {
        throw new Error("Current AGM password is incorrect");
      }
      users[index] = {
        ...users[index],
        password: newPassword,
        mustChangePassword: false,
      };
      writeLocalUsers(users);
    },
    async resetPassword(
      username: string,
      resetCode: string,
      newPassword: string,
    ): Promise<void> {
      const users = readLocalUsers();
      const index = users.findIndex(
        (item) => item.username.trim().toLowerCase() === username.trim().toLowerCase(),
      );
      if (index < 0) {
        throw new Error("AGM user not found");
      }
      const expectedCode = `${AGM_LOCAL_RESET_PREFIX}${users[index].username}`;
      if (resetCode.trim().toUpperCase() !== expectedCode.toUpperCase()) {
        throw new Error(`Use reset code ${expectedCode} for local AGM access`);
      }
      users[index] = {
        ...users[index],
        password: newPassword,
        mustChangePassword: false,
      };
      writeLocalUsers(users);
    },
  };
}

function unwrapOkErr<T>(result: { ok?: T; err?: string; __kind__?: string }): T {
  if ("__kind__" in result) {
    if (result.__kind__ === "err") {
      throw new Error(result.err ?? "AGM request failed");
    }
    return result.ok as T;
  }
  if ("err" in result && result.err) {
    throw new Error(result.err);
  }
  if ("ok" in result) {
    return result.ok as T;
  }
  throw new Error("AGM request failed");
}

function mapAgmRole(role: unknown): AgmRole {
  if (!role || typeof role !== "object") return "Viewer";
  const key = Object.keys(role as Record<string, unknown>)[0] as AgmRole | undefined;
  switch (key) {
    case "SuperAdmin":
    case "Admin":
    case "BoardViewer":
    case "ReportsViewer":
    case "RegistrationOfficer":
    case "Viewer":
      return key;
    default:
      return "Viewer";
  }
}

export function buildAgmAuthClient(actor: ActorLike) {
  const agmActor = actor as ActorLike & {
    agmLogin: (
      username: string,
      password: string,
    ) => Promise<{ ok?: unknown; err?: string; __kind__?: string }>;
    agmValidateSession: (
      token: string,
    ) => Promise<{ ok?: unknown; err?: string; __kind__?: string }>;
    agmLogout: (token: string) => Promise<void>;
    agmChangePasswordSecure: (
      token: string,
      oldPassword: string,
      newPassword: string,
    ) => Promise<{ ok?: unknown; err?: string; __kind__?: string }>;
    agmResetPasswordWithCode: (
      username: string,
      resetCode: string,
      newPassword: string,
    ) => Promise<{ ok?: unknown; err?: string; __kind__?: string }>;
  };

  return {
    async login(username: string, password: string): Promise<AgmLoginResult> {
      const data = unwrapOkErr<{
        token: string;
        username: string;
        role: unknown;
        mustChangePassword: boolean;
      }>(await agmActor.agmLogin(username, password));
      return {
        token: data.token,
        username: data.username,
        role: mapAgmRole(data.role),
        mustChangePassword: data.mustChangePassword,
      };
    },
    async validateSession(token: string): Promise<AgmSessionResult> {
      const data = unwrapOkErr<{
        token: string;
        username: string;
        role: unknown;
        expiresAt: bigint;
      }>(await agmActor.agmValidateSession(token));
      return {
        token: data.token,
        username: data.username,
        role: mapAgmRole(data.role),
        expiresAt: data.expiresAt,
      };
    },
    async logout(token: string): Promise<void> {
      await agmActor.agmLogout(token);
    },
    async changePassword(
      token: string,
      oldPassword: string,
      newPassword: string,
    ): Promise<void> {
      unwrapOkErr<null>(
        await agmActor.agmChangePasswordSecure(token, oldPassword, newPassword),
      );
    },
    async resetPassword(
      username: string,
      resetCode: string,
      newPassword: string,
    ): Promise<void> {
      unwrapOkErr<null>(
        await agmActor.agmResetPasswordWithCode(username, resetCode, newPassword),
      );
    },
  };
}
