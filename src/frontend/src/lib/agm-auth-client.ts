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
