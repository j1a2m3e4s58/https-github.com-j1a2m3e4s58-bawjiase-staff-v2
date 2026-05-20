import { createActor } from "@/backend";
import type {
  AGMSettings,
  AppUser,
  AuditEntry,
  BulkCreateResult,
  CheckIn,
  DashboardMetrics,
  ImportBatch,
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
import { buildClient } from "@/lib/backend-client";
import type { AgmYearRecord } from "@/lib/backend-client";
import { storage } from "@/lib/storage";
import { useAppActor } from "@/lib/use-app-actor";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

function useClient() {
  const { actor, isFetching } = useAppActor(createActor);
  const ready = !!actor && !isFetching && !!storage.getSessionToken();
  return { client: actor ? buildClient(actor) : null, ready };
}

// Settings
export function useSettings() {
  const { client, ready } = useClient();
  return useQuery<AGMSettings>({
    queryKey: ["settings"],
    queryFn: () => client!.getSettings(),
    enabled: ready,
    staleTime: 60_000,
  });
}

export function useUpdateSettings() {
  const { client } = useClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: AGMSettings) => client!.updateSettings(settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useYearRegistry() {
  const { client, ready } = useClient();
  return useQuery<AgmYearRecord[]>({
    queryKey: ["agm-year-registry"],
    queryFn: () => client!.getYearRegistry(),
    enabled: ready,
    staleTime: 60_000,
  });
}

export function useUpdateYearRecord() {
  const { client } = useClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      year,
      updates,
    }: {
      year: string;
      updates: { isLocked?: boolean; isArchived?: boolean };
    }) => client!.updateYearRecord(year, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agm-year-registry"] }),
  });
}

export function useCloneYearSettings() {
  const { client } = useClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      fromYear,
      toYear,
    }: {
      fromYear: string;
      toYear: string;
    }) => client!.cloneYearSettings(fromYear, toYear),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agm-year-registry"] }),
  });
}

export function useRecordAuditEvent() {
  const { client } = useClient();
  return useMutation({
    mutationFn: ({
      action,
      entityType,
      entityId,
      details,
    }: {
      action: string;
      entityType: string;
      entityId: string;
      details: string;
    }) => client!.recordAuditEvent(action, entityType, entityId, details),
  });
}

// Dashboard
export function useDashboardMetrics(quorumThreshold: bigint = BigInt(0)) {
  const { client, ready } = useClient();
  return useQuery<DashboardMetrics>({
    queryKey: ["dashboard", quorumThreshold.toString()],
    queryFn: () => client!.getDashboardMetrics(quorumThreshold),
    enabled: ready,
    refetchInterval: 5_000,
  });
}

// Shareholders
export function useAllShareholders() {
  const { client, ready } = useClient();
  return useQuery<Shareholder[]>({
    queryKey: ["shareholders"],
    queryFn: () => client!.getAllShareholders(),
    enabled: ready,
  });
}

export function useShareholder(id: string) {
  const { client, ready } = useClient();
  return useQuery<Shareholder | null>({
    queryKey: ["shareholder", id],
    queryFn: () => client!.getShareholder(id),
    enabled: ready && !!id,
  });
}

export function useSearchShareholders(
  query: string,
  status: ShareholderStatus | null,
  page: bigint,
  pageSize: bigint,
) {
  const { client, ready } = useClient();
  return useQuery<SearchResult>({
    queryKey: [
      "shareholders",
      "search",
      query,
      status,
      page.toString(),
      pageSize.toString(),
    ],
    queryFn: () => client!.searchShareholders(query, status, page, pageSize),
    enabled: ready,
  });
}

export function useCreateShareholder() {
  const { client } = useClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ShareholderInput) => client!.createShareholder(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shareholders"] }),
  });
}

export function useBulkCreateShareholders() {
  const { client } = useClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: ShareholderInput[]): Promise<BulkCreateResult> =>
      client!.bulkCreateShareholders(items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shareholders"] }),
  });
}

export function useUpdateShareholderStatus() {
  const { client } = useClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ShareholderStatus }) =>
      client!.updateShareholderStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shareholders"] }),
  });
}

export function useDeleteAllShareholders() {
  const { client } = useClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => client!.deleteAllShareholders(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shareholders"] }),
  });
}

// Registrations
export function useAllRegistrations() {
  const { client, ready } = useClient();
  return useQuery<Registration[]>({
    queryKey: ["registrations"],
    queryFn: () => client!.getAllRegistrations(),
    enabled: ready,
  });
}

export function useRegistrationByShareholder(shareholderId: string) {
  const { client, ready } = useClient();
  return useQuery<Registration | null>({
    queryKey: ["registration", "by-shareholder", shareholderId],
    queryFn: () => client!.getRegistrationByShareholder(shareholderId),
    enabled: ready && !!shareholderId,
  });
}

export function useRegisterShareholder() {
  const { client } = useClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      shareholderId,
      regType,
      proxyData,
    }: {
      shareholderId: string;
      regType: RegistrationType;
      proxyData: ProxyData | null;
    }): Promise<Registration> =>
      client!.registerShareholder(shareholderId, regType, proxyData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shareholders"] });
      qc.invalidateQueries({ queryKey: ["registrations"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateRegistration() {
  const { client } = useClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: { id: string; updates: RegistrationUpdate }): Promise<Registration> =>
      client!.updateRegistration(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["registrations"] }),
  });
}

export function useCancelRegistration() {
  const { client } = useClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      client!.cancelRegistration(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registrations"] });
      qc.invalidateQueries({ queryKey: ["shareholders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useValidateProxyProof() {
  const { client } = useClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      registrationId,
      validated,
      fraudFlags,
    }: {
      registrationId: string;
      validated: boolean;
      fraudFlags: string[];
    }): Promise<Registration> =>
      client!.validateProxyProof(registrationId, validated, fraudFlags),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["registrations"] }),
  });
}

// Check-Ins
export function useAllCheckIns() {
  const { client, ready } = useClient();
  return useQuery<CheckIn[]>({
    queryKey: ["checkins"],
    queryFn: () => client!.getAllCheckIns(),
    enabled: ready,
    refetchInterval: 5_000,
  });
}

export function useCheckInByShareholder(shareholderId: string) {
  const { client, ready } = useClient();
  return useQuery<CheckIn | null>({
    queryKey: ["checkin", "by-shareholder", shareholderId],
    queryFn: () => client!.getCheckInByShareholder(shareholderId),
    enabled: ready && !!shareholderId,
  });
}

export function useCheckInShareholder() {
  const { client } = useClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      shareholderId,
      registrationId,
      method,
    }: {
      shareholderId: string;
      registrationId: string;
      method: CheckInMethod;
    }): Promise<CheckIn> =>
      client!.checkInShareholder(shareholderId, registrationId, method),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shareholders"] });
      qc.invalidateQueries({ queryKey: ["checkins"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUndoCheckIn() {
  const { client } = useClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shareholderId: string) => client!.undoCheckIn(shareholderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shareholders"] });
      qc.invalidateQueries({ queryKey: ["checkins"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// Import Batches
export function useImportBatches() {
  const { client, ready } = useClient();
  return useQuery<ImportBatch[]>({
    queryKey: ["import-batches"],
    queryFn: () => client!.getImportBatches(),
    enabled: ready,
  });
}

export function useCreateImportBatch() {
  const { client } = useClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      filename,
      totalRows,
    }: { filename: string; totalRows: bigint }): Promise<ImportBatch> =>
      client!.createImportBatch(filename, totalRows),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["import-batches"] }),
  });
}

export function useUpdateImportBatchStatus() {
  const { client } = useClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      importedRows,
      duplicates,
    }: {
      id: string;
      status: ImportStatus;
      importedRows: bigint;
      duplicates: bigint;
    }): Promise<ImportBatch> =>
      client!.updateImportBatchStatus(id, status, importedRows, duplicates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["import-batches"] }),
  });
}

// Users (Admin)
export function useGetUsers() {
  const { client, ready } = useClient();
  return useQuery<AppUser[]>({
    queryKey: ["users"],
    queryFn: () => client!.getUsers(),
    enabled: ready,
  });
}

export function useCreateUser() {
  const { client } = useClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      username,
      password,
      role,
      phoneNumber,
    }: {
      username: string;
      password: string;
      role: UserRole;
      phoneNumber: string;
    }): Promise<AppUser> =>
      client!.createUser(username, password, role, phoneNumber),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUserRole() {
  const { client } = useClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      username,
      role,
    }: { username: string; role: UserRole }): Promise<AppUser> =>
      client!.updateUserRole(username, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeactivateUser() {
  const { client } = useClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => client!.deactivateUser(username),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useGetActiveSessions() {
  const { client, ready } = useClient();
  return useQuery<Session[]>({
    queryKey: ["active-sessions"],
    queryFn: () => client!.getActiveSessions(),
    enabled: ready,
    refetchInterval: 30_000,
  });
}

export function useForceLogout() {
  const { client } = useClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => client!.forceLogout(username),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["active-sessions"] }),
  });
}

export function useCreatePasswordResetCode() {
  const { client } = useClient();
  return useMutation({
    mutationFn: (username: string) => client!.createPasswordResetCode(username),
  });
}

// Audit Log
export function useAuditLog(
  entityType: string | null,
  entityId: string | null,
  limit: bigint = BigInt(100),
) {
  const { client, ready } = useClient();
  return useQuery<AuditEntry[]>({
    queryKey: ["audit", entityType, entityId, limit.toString()],
    queryFn: () => client!.getAuditLog(entityType, entityId, limit),
    enabled: ready,
  });
}

export function useAuditLogForExport() {
  const { client, ready } = useClient();
  return useQuery<AuditEntry[]>({
    queryKey: ["audit", "export"],
    queryFn: () => client!.getAuditLogForExport(),
    enabled: ready,
  });
}

export function useDeleteAuditEntries() {
  const { client } = useClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryIds: string[]) => client!.deleteAuditEntries(entryIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

// Re-export for convenience
export {
  CheckInMethod,
  ImportStatus,
  RegistrationType,
  ShareholderStatus,
  UserRole,
};
