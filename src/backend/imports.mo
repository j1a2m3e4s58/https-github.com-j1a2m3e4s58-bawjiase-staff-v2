import Map "mo:core/Map";
import Time "mo:core/Time";
import Nat "mo:core/Nat";
import Types "./types/agm-types";

module {

  // ─── State Types ─────────────────────────────────────────────────────────

  public type ImportState = {
    batches : Map.Map<Text, Types.ImportBatch>;
    counter : { var value : Nat };
  };

  public func newState() : ImportState {
    {
      batches = Map.empty<Text, Types.ImportBatch>();
      counter = { var value = 0 };
    };
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────

  func generateId(state : ImportState) : Text {
    state.counter.value += 1;
    "imp-" # Time.now().toText() # "-" # state.counter.value.toText();
  };

  // ─── Public API ──────────────────────────────────────────────────────────

  public func createImportBatch(
    state : ImportState,
    filename : Text,
    uploadedBy : Text,
    totalRows : Nat,
  ) : Types.ImportBatch {
    let id = generateId(state);
    let batch : Types.ImportBatch = {
      id;
      filename;
      uploadedBy;
      uploadedAt = Time.now();
      totalRows;
      importedRows = 0;
      duplicatesSkipped = 0;
      status = #Pending;
    };
    state.batches.add(id, batch);
    batch;
  };

  public func updateImportBatchStatus(
    state : ImportState,
    id : Text,
    status : Types.ImportStatus,
    importedRows : Nat,
    duplicates : Nat,
  ) : { #ok : Types.ImportBatch; #err : Text } {
    switch (state.batches.get(id)) {
      case null #err "IMPORT_BATCH_NOT_FOUND";
      case (?existing) {
        let updated = { existing with status; importedRows; duplicatesSkipped = duplicates };
        state.batches.add(id, updated);
        #ok updated;
      };
    };
  };

  public func getImportBatch(state : ImportState, id : Text) : ?Types.ImportBatch {
    state.batches.get(id);
  };

  public func getImportBatches(state : ImportState) : [Types.ImportBatch] {
    state.batches.values().toArray();
  };

};
