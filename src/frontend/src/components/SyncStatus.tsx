import { AgmSyncStatus } from "@/components/AgmSyncStatus";

export function useSyncStatus() {
  return { pendingCount: 0 };
}

export function SyncStatus() {
  return <AgmSyncStatus />;
}
