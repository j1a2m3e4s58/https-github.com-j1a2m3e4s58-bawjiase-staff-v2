import type {
  AGMSettings,
  AppUser,
  AuditEntry,
  BulkCreateResult,
  CheckIn,
  DashboardMetrics,
  ImportBatch,
  LoginResponse,
  ProxyData,
  Registration,
  RegistrationUpdate,
  SearchResult,
  Session,
  Shareholder,
  ShareholderInput,
} from "@/types";
import {
  CheckInMethod,
  ImportStatus,
  RegistrationType,
  ShareholderStatus,
  UserRole,
} from "@/types";

type Result<T> = { __kind__: "ok"; ok: T } | { __kind__: "err"; err: string };
type PasswordResetCode = {
  code: string;
  username: string;
  issuedBy: string;
  issuedAt: bigint;
  expiresAt: bigint;
  attempts: bigint;
};

const BIGINT_SENTINEL = "__bigint__";

function serialize(value: unknown) {
  return JSON.stringify(value, (_key, currentValue) => {
    if (typeof currentValue === "bigint") {
      return { [BIGINT_SENTINEL]: currentValue.toString() };
    }
    return currentValue;
  });
}

function deserialize<T>(text: string): T {
  return JSON.parse(text, (_key, currentValue) => {
    if (
      currentValue &&
      typeof currentValue === "object" &&
      BIGINT_SENTINEL in currentValue
    ) {
      return BigInt(
        (currentValue as Record<string, string>)[BIGINT_SENTINEL],
      );
    }
    return currentValue;
  }) as T;
}

async function rpc<T>(baseUrl: string, method: string, args: unknown[]): Promise<T> {
  const response = await fetch(`${baseUrl}/rpc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: serialize({ method, args }),
  });

  const payload = deserialize<{ result?: T; error?: string }>(
    await response.text(),
  );
  if (!response.ok) {
    throw new Error(payload.error ?? `RPC ${method} failed`);
  }
  return payload.result as T;
}

export function createRuntimeBackend(
  baseUrl =
    import.meta.env.VITE_RUNTIME_BACKEND_URL ??
    (typeof window !== "undefined" &&
    window.location.hostname.endsWith("onrender.com")
      ? "https://agm-pro-backend.onrender.com"
      : "http://127.0.0.1:8788"),
) {
  return {
    login(username: string, password: string) {
      return rpc<Result<LoginResponse>>(baseUrl, "login", [username, password]);
    },
    validateSession(token: string) {
      return rpc<Result<Session>>(baseUrl, "validateSession", [token]);
    },
    logout(token: string) {
      return rpc<void>(baseUrl, "logout", [token]);
    },
    changePassword(username: string, oldPassword: string, newPassword: string) {
      return rpc<Result<null>>(baseUrl, "changePassword", [
        username,
        oldPassword,
        newPassword,
      ]);
    },
    changePasswordSecure(
      token: string,
      oldPassword: string,
      newPassword: string,
    ) {
      return rpc<Result<null>>(baseUrl, "changePasswordSecure", [
        token,
        oldPassword,
        newPassword,
      ]);
    },
    resetPasswordWithCode(
      username: string,
      resetCode: string,
      newPassword: string,
    ) {
      return rpc<Result<null>>(baseUrl, "resetPasswordWithCode", [
        username,
        resetCode,
        newPassword,
      ]);
    },
    createPasswordResetCode(adminToken: string, username: string) {
      return rpc<Result<PasswordResetCode>>(baseUrl, "createPasswordResetCode", [
        adminToken,
        username,
      ]);
    },
    getFirstTimeVerificationState(sessionToken: string) {
      return rpc<
        Result<{ phoneNumber: string; tokenHint: string; isVerified: boolean }>
      >(baseUrl, "getFirstTimeVerificationState", [sessionToken]);
    },
    completeFirstTimeVerification(
      sessionToken: string,
      phoneNumber: string,
      tokenCode: string,
    ) {
      return rpc<Result<void>>(baseUrl, "completeFirstTimeVerification", [
        sessionToken,
        phoneNumber,
        tokenCode,
      ]);
    },
    getSettings() {
      return rpc<AGMSettings>(baseUrl, "getSettings", []);
    },
    updateSettings(adminToken: string, newSettings: AGMSettings) {
      return rpc<Result<AGMSettings>>(baseUrl, "updateSettings", [
        adminToken,
        newSettings,
      ]);
    },
    getYearRegistry(sessionToken: string) {
      return rpc<Result<unknown[]>>(baseUrl, "getYearRegistry", [sessionToken]);
    },
    updateYearRecord(
      sessionToken: string,
      year: string,
      updates: { isLocked?: boolean; isArchived?: boolean },
    ) {
      return rpc<Result<unknown>>(baseUrl, "updateYearRecord", [
        sessionToken,
        year,
        updates,
      ]);
    },
    cloneYearSettings(sessionToken: string, fromYear: string, toYear: string) {
      return rpc<Result<unknown>>(baseUrl, "cloneYearSettings", [
        sessionToken,
        fromYear,
        toYear,
      ]);
    },
    recordAuditEvent(
      sessionToken: string,
      action: string,
      entityType: string,
      entityId: string,
      details: string,
    ) {
      return rpc<Result<null>>(baseUrl, "recordAuditEvent", [
        sessionToken,
        action,
        entityType,
        entityId,
        details,
      ]);
    },
    getDashboardMetrics(quorumThreshold: bigint) {
      return rpc<DashboardMetrics>(baseUrl, "getDashboardMetrics", [
        quorumThreshold,
      ]);
    },
    getAllShareholders() {
      return rpc<Shareholder[]>(baseUrl, "getAllShareholders", []);
    },
    getAllShareholdersSecure(token: string) {
      return rpc<Result<Shareholder[]>>(baseUrl, "getAllShareholdersSecure", [
        token,
      ]);
    },
    getShareholder(id: string) {
      return rpc<Shareholder | null>(baseUrl, "getShareholder", [id]);
    },
    getShareholderSecure(token: string, id: string) {
      return rpc<Result<Shareholder | null>>(baseUrl, "getShareholderSecure", [
        token,
        id,
      ]);
    },
    getShareholderByNumber(shareholderNumber: string) {
      return rpc<Shareholder | null>(baseUrl, "getShareholderByNumber", [
        shareholderNumber,
      ]);
    },
    getShareholderByNumberSecure(token: string, shareholderNumber: string) {
      return rpc<Result<Shareholder | null>>(
        baseUrl,
        "getShareholderByNumberSecure",
        [token, shareholderNumber],
      );
    },
    searchShareholders(
      searchQuery: string,
      statusFilter: ShareholderStatus | null,
      page: bigint,
      pageSize: bigint,
    ) {
      return rpc<SearchResult>(baseUrl, "searchShareholders", [
        searchQuery,
        statusFilter,
        page,
        pageSize,
      ]);
    },
    searchShareholdersSecure(
      token: string,
      searchQuery: string,
      statusFilter: ShareholderStatus | null,
      page: bigint,
      pageSize: bigint,
    ) {
      return rpc<Result<SearchResult>>(baseUrl, "searchShareholdersSecure", [
        token,
        searchQuery,
        statusFilter,
        page,
        pageSize,
      ]);
    },
    createShareholder(data: ShareholderInput, importedBy: string) {
      return rpc<Result<Shareholder>>(baseUrl, "createShareholder", [
        data,
        importedBy,
      ]);
    },
    bulkCreateShareholders(items: ShareholderInput[], importedBy: string) {
      return rpc<BulkCreateResult>(baseUrl, "bulkCreateShareholders", [
        items,
        importedBy,
      ]);
    },
    updateShareholderStatus(
      id: string,
      status: ShareholderStatus,
      updatedBy: string,
    ) {
      return rpc<Result<Shareholder>>(baseUrl, "updateShareholderStatus", [
        id,
        status,
        updatedBy,
      ]);
    },
    deleteAllShareholders(deletedBy: string) {
      return rpc<Result<bigint>>(baseUrl, "deleteAllShareholders", [deletedBy]);
    },
    getAllRegistrations() {
      return rpc<Registration[]>(baseUrl, "getAllRegistrations", []);
    },
    getRegistration(id: string) {
      return rpc<Registration | null>(baseUrl, "getRegistration", [id]);
    },
    getRegistrationByShareholder(shareholderId: string) {
      return rpc<Registration | null>(baseUrl, "getRegistrationByShareholder", [
        shareholderId,
      ]);
    },
    registerShareholder(
      shareholderId: string,
      regType: RegistrationType,
      proxyData: ProxyData | null,
      registeredBy: string,
    ) {
      return rpc<Result<Registration>>(baseUrl, "registerShareholder", [
        shareholderId,
        regType,
        proxyData,
        registeredBy,
      ]);
    },
    updateRegistration(
      id: string,
      updates: RegistrationUpdate,
      updatedBy: string,
    ) {
      return rpc<Result<Registration>>(baseUrl, "updateRegistration", [
        id,
        updates,
        updatedBy,
      ]);
    },
    cancelRegistration(id: string, cancelledBy: string, reason: string) {
      return rpc<Result<null>>(baseUrl, "cancelRegistration", [
        id,
        cancelledBy,
        reason,
      ]);
    },
    validateProxyProof(
      registrationId: string,
      validated: boolean,
      fraudFlags: string[],
      validatedBy: string,
    ) {
      return rpc<Result<Registration>>(baseUrl, "validateProxyProof", [
        registrationId,
        validated,
        fraudFlags,
        validatedBy,
      ]);
    },
    getAllCheckIns() {
      return rpc<CheckIn[]>(baseUrl, "getAllCheckIns", []);
    },
    getCheckIn(id: string) {
      return rpc<CheckIn | null>(baseUrl, "getCheckIn", [id]);
    },
    getCheckInByShareholder(shareholderId: string) {
      return rpc<CheckIn | null>(baseUrl, "getCheckInByShareholder", [
        shareholderId,
      ]);
    },
    checkInShareholder(
      shareholderId: string,
      registrationId: string,
      method: CheckInMethod,
      checkedInBy: string,
    ) {
      return rpc<Result<CheckIn>>(baseUrl, "checkInShareholder", [
        shareholderId,
        registrationId,
        method,
        checkedInBy,
      ]);
    },
    undoCheckIn(shareholderId: string, undoneBy: string) {
      return rpc<Result<null>>(baseUrl, "undoCheckIn", [
        shareholderId,
        undoneBy,
      ]);
    },
    createImportBatch(filename: string, uploadedBy: string, totalRows: bigint) {
      return rpc<ImportBatch>(baseUrl, "createImportBatch", [
        filename,
        uploadedBy,
        totalRows,
      ]);
    },
    updateImportBatchStatus(
      id: string,
      status: ImportStatus,
      importedRows: bigint,
      duplicates: bigint,
    ) {
      return rpc<Result<ImportBatch>>(baseUrl, "updateImportBatchStatus", [
        id,
        status,
        importedRows,
        duplicates,
      ]);
    },
    getImportBatch(id: string) {
      return rpc<ImportBatch | null>(baseUrl, "getImportBatch", [id]);
    },
    getImportBatches() {
      return rpc<ImportBatch[]>(baseUrl, "getImportBatches", []);
    },
    getUsers(adminToken: string) {
      return rpc<Result<AppUser[]>>(baseUrl, "getUsers", [adminToken]);
    },
    createUser(
      adminToken: string,
      username: string,
      password: string,
      role: UserRole,
    ) {
      return rpc<Result<AppUser>>(baseUrl, "createUser", [
        adminToken,
        username,
        password,
        role,
      ]);
    },
    createUserWithPhone(
      adminToken: string,
      username: string,
      password: string,
      role: UserRole,
      phoneNumber: string,
    ) {
      return rpc<Result<AppUser>>(baseUrl, "createUserWithPhone", [
        adminToken,
        username,
        password,
        role,
        phoneNumber,
      ]);
    },
    updateUserRole(adminToken: string, username: string, role: UserRole) {
      return rpc<Result<AppUser>>(baseUrl, "updateUserRole", [
        adminToken,
        username,
        role,
      ]);
    },
    deactivateUser(adminToken: string, username: string) {
      return rpc<Result<null>>(baseUrl, "deactivateUser", [adminToken, username]);
    },
    getActiveSessions(adminToken: string) {
      return rpc<Result<Session[]>>(baseUrl, "getActiveSessions", [adminToken]);
    },
    forceLogout(adminToken: string, username: string) {
      return rpc<Result<null>>(baseUrl, "forceLogout", [adminToken, username]);
    },
    getAuditLog(entityType: string | null, entityId: string | null, limit: bigint) {
      return rpc<AuditEntry[]>(baseUrl, "getAuditLog", [
        entityType,
        entityId,
        limit,
      ]);
    },
    getAuditLogForExport() {
      return rpc<AuditEntry[]>(baseUrl, "getAuditLogForExport", []);
    },
    deleteAuditEntries(adminToken: string, entryIds: string[]) {
      return rpc<Result<bigint>>(baseUrl, "deleteAuditEntries", [
        adminToken,
        entryIds,
      ]);
    },
  };
}
