import Map "mo:core/Map";
import Time "mo:core/Time";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Types "./types/agm-types";

module {

  // ─── State Types ─────────────────────────────────────────────────────────

  public type CheckInState = {
    byId : Map.Map<Text, Types.CheckIn>;
    byShareholder : Map.Map<Text, Text>;
    counter : { var value : Nat };
  };

  public func newState() : CheckInState {
    {
      byId = Map.empty<Text, Types.CheckIn>();
      byShareholder = Map.empty<Text, Text>();
      counter = { var value = 0 };
    };
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────

  func generateId(state : CheckInState) : Text {
    state.counter.value += 1;
    "chk-" # Time.now().toText() # "-" # state.counter.value.toText();
  };

  // ─── Public API ──────────────────────────────────────────────────────────

  public func checkInShareholder(
    state : CheckInState,
    shareholderId : Text,
    registrationId : Text,
    registrationExists : Bool,
    method : Types.CheckInMethod,
    checkedInBy : Text,
  ) : { #ok : Types.CheckIn; #err : Text } {
    if (not registrationExists) return #err "NOT_REGISTERED";
    if (state.byShareholder.containsKey(shareholderId)) {
      return #err "ALREADY_CHECKED_IN";
    };
    let id = generateId(state);
    let checkIn : Types.CheckIn = {
      id;
      shareholderId;
      registrationId;
      checkedInBy;
      checkedInAt = Time.now();
      method;
    };
    state.byId.add(id, checkIn);
    state.byShareholder.add(shareholderId, id);
    #ok checkIn;
  };

  public func getCheckIn(state : CheckInState, id : Text) : ?Types.CheckIn {
    state.byId.get(id);
  };

  public func getCheckInByShareholder(state : CheckInState, shareholderId : Text) : ?Types.CheckIn {
    switch (state.byShareholder.get(shareholderId)) {
      case (?checkInId) state.byId.get(checkInId);
      case null null;
    };
  };

  public func undoCheckIn(
    state : CheckInState,
    shareholderId : Text,
    undoneBy : Text,
  ) : { #ok; #err : Text } {
    switch (state.byShareholder.get(shareholderId)) {
      case null #err "NOT_CHECKED_IN";
      case (?checkInId) {
        state.byShareholder.remove(shareholderId);
        state.byId.remove(checkInId);
        ignore undoneBy;
        #ok;
      };
    };
  };

  public func getAllCheckIns(state : CheckInState) : [Types.CheckIn] {
    state.byId.values().toArray();
  };

};
