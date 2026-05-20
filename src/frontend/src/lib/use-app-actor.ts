import { useMemo } from "react";
import { createRuntimeBackend } from "./runtime-backend";

export function useAppActor<TActor>(
  _createActor: (...args: any[]) => TActor,
): { actor: TActor | null; isFetching: boolean } {
  const actor = useMemo(
    () => createRuntimeBackend() as unknown as TActor,
    [],
  );

  return {
    actor,
    isFetching: false,
  };
}
