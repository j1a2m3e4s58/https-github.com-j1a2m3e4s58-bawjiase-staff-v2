import List "mo:core/List";
import Time "mo:core/Time";
import Nat "mo:core/Nat";
import Types "./types/agm-types";

module {

  // ─── State Types ─────────────────────────────────────────────────────────

  public type AuditState = {
    log : List.List<Types.AuditEntry>;
    counter : { var value : Nat };
  };

  public func newState() : AuditState {
    { log = List.empty<Types.AuditEntry>(); counter = { var value = 0 } };
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────

  func generateId(state : AuditState) : Text {
    state.counter.value += 1;
    "audit-" # Time.now().toText() # "-" # state.counter.value.toText();
  };

  // ─── Public API ──────────────────────────────────────────────────────────

  public func logAction(
    state : AuditState,
    action : Text,
    entityType : Text,
    entityId : Text,
    performedBy : Text,
    details : Text,
  ) : Types.AuditEntry {
    let entry : Types.AuditEntry = {
      id = generateId(state);
      action;
      entityType;
      entityId;
      performedBy;
      performedAt = Time.now();
      details;
      ipAddress = null;
    };
    state.log.add(entry);
    entry;
  };

  public func getAuditLog(
    state : AuditState,
    entityTypeFilter : ?Text,
    entityIdFilter : ?Text,
    limit : Nat,
  ) : [Types.AuditEntry] {
    let effectiveLimit = if (limit == 0) 100 else if (limit > 1000) 1000 else limit;
    let filtered = state.log.filter(func(e : Types.AuditEntry) : Bool {
      let typeMatch = switch entityTypeFilter {
        case null true;
        case (?t) e.entityType == t;
      };
      let idMatch = switch entityIdFilter {
        case null true;
        case (?i) e.entityId == i;
      };
      typeMatch and idMatch;
    });
    let rev = filtered.reverse();
    let taken = rev.sliceToArray(0, Nat.min(effectiveLimit, rev.size()));
    taken.reverse();
  };

  public func getAuditLogForExport(state : AuditState) : [Types.AuditEntry] {
    state.log.toArray();
  };

};
