import Map "mo:core/Map";
import List "mo:core/List";
import Time "mo:core/Time";
import Float "mo:core/Float";
import Nat "mo:core/Nat";
import Types "./types/agm-types";

module {

  public type ShareholderInput = {
    shareholderNumber : Text;
    fullName : Text;
    idNumber : Text;
    email : ?Text;
    phone : ?Text;
    shareholding : Nat;
    tags : [Text];
  };

  public type SearchResult = {
    items : [Types.Shareholder];
    total : Nat;
    page : Nat;
  };

  public type BulkCreateResult = {
    created : Nat;
    duplicates : Nat;
    errors : [Text];
  };

  // ─── State Types ─────────────────────────────────────────────────────────

  public type ShareholderState = {
    byId : Map.Map<Text, Types.Shareholder>;
    byNumber : Map.Map<Text, Text>;
    counter : { var value : Nat };
  };

  public func newState() : ShareholderState {
    {
      byId = Map.empty<Text, Types.Shareholder>();
      byNumber = Map.empty<Text, Text>();
      counter = { var value = 0 };
    };
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────

  func generateId(state : ShareholderState) : Text {
    state.counter.value += 1;
    "sh-" # Time.now().toText() # "-" # state.counter.value.toText();
  };

  func matchesQuery(s : Types.Shareholder, q : Text) : Bool {
    if (q == "") return true;
    let lower = q.toLower();
    s.fullName.toLower().contains(#text lower) or
    s.shareholderNumber.toLower().contains(#text lower) or
    s.idNumber.toLower().contains(#text lower);
  };

  func matchesStatus(s : Types.Shareholder, filter : ?Types.ShareholderStatus) : Bool {
    switch filter {
      case null true;
      case (?st) {
        switch (s.status, st) {
          case (#NotRegistered, #NotRegistered) true;
          case (#RegisteredInPerson, #RegisteredInPerson) true;
          case (#RegisteredProxy, #RegisteredProxy) true;
          case (#CheckedIn, #CheckedIn) true;
          case _ false;
        };
      };
    };
  };

  // ─── Public API ──────────────────────────────────────────────────────────

  public func createShareholder(
    state : ShareholderState,
    data : ShareholderInput,
    importedBy : Text,
  ) : { #ok : Types.Shareholder; #err : Text } {
    if (data.shareholderNumber == "") return #err "MISSING_SHAREHOLDER_NUMBER";
    if (data.fullName == "") return #err "MISSING_FULL_NAME";
    if (data.idNumber == "") return #err "MISSING_ID_NUMBER";
    if (state.byNumber.containsKey(data.shareholderNumber)) {
      return #err "DUPLICATE_SHAREHOLDER_NUMBER";
    };
    let id = generateId(state);
    let now = Time.now();
    let shareholder : Types.Shareholder = {
      id;
      shareholderNumber = data.shareholderNumber;
      fullName = data.fullName;
      idNumber = data.idNumber;
      email = data.email;
      phone = data.phone;
      shareholding = data.shareholding;
      tags = data.tags;
      importedAt = now;
      importedBy;
      status = #NotRegistered;
    };
    state.byId.add(id, shareholder);
    state.byNumber.add(data.shareholderNumber, id);
    #ok shareholder;
  };

  public func getShareholder(state : ShareholderState, id : Text) : ?Types.Shareholder {
    state.byId.get(id);
  };

  public func getShareholderByNumber(state : ShareholderState, shareholderNumber : Text) : ?Types.Shareholder {
    switch (state.byNumber.get(shareholderNumber)) {
      case null null;
      case (?id) state.byId.get(id);
    };
  };

  public func searchShareholders(
    state : ShareholderState,
    searchQuery : Text,
    statusFilter : ?Types.ShareholderStatus,
    page : Nat,
    pageSize : Nat,
  ) : SearchResult {
    let effectivePageSize = if (pageSize == 0) 50 else pageSize;
    let matched = state.byId.values().filter(
      func(s) { matchesQuery(s, searchQuery) and matchesStatus(s, statusFilter) }
    ).toArray();
    let total = matched.size();
    let start = page * effectivePageSize;
    let items = if (start >= total) {
      [];
    } else {
      let end = if (start + effectivePageSize > total) total else start + effectivePageSize;
      matched.sliceToArray(start, end);
    };
    { items; total; page };
  };

  public func updateShareholderStatus(
    state : ShareholderState,
    id : Text,
    status : Types.ShareholderStatus,
    updatedBy : Text,
  ) : { #ok : Types.Shareholder; #err : Text } {
    switch (state.byId.get(id)) {
      case null #err "SHAREHOLDER_NOT_FOUND";
      case (?existing) {
        ignore updatedBy;
        let updated = { existing with status };
        state.byId.add(id, updated);
        #ok updated;
      };
    };
  };

  public func updateShareholderContact(
    state : ShareholderState,
    id : Text,
    phone : ?Text,
    idNumber : Text,
    updatedBy : Text,
  ) : { #ok : Types.Shareholder; #err : Text } {
    switch (state.byId.get(id)) {
      case null #err "SHAREHOLDER_NOT_FOUND";
      case (?existing) {
        ignore updatedBy;
        let updated = {
          existing with
          phone;
          idNumber;
        };
        state.byId.add(id, updated);
        #ok updated;
      };
    };
  };

  public func getDashboardMetrics(state : ShareholderState, quorumThreshold : Nat) : Types.DashboardMetrics {
    var total = 0;
    var registeredInPerson = 0;
    var registeredProxy = 0;
    var checkedIn = 0;
    var notRegistered = 0;

    state.byId.values().forEach(func(s) {
      total += 1;
      switch (s.status) {
        case (#NotRegistered) notRegistered += 1;
        case (#RegisteredInPerson) registeredInPerson += 1;
        case (#RegisteredProxy) registeredProxy += 1;
        case (#CheckedIn) checkedIn += 1;
      };
    });

    let registered = registeredInPerson + registeredProxy + checkedIn;
    let attendanceRate : Float = if (total == 0) 0.0 else
      checkedIn.toFloat() / total.toFloat() * 100.0;
    let quorumStatus = attendanceRate >= quorumThreshold.toFloat();

    {
      totalShareholders = total;
      registered;
      registeredInPerson;
      registeredProxy;
      checkedIn;
      notRegistered;
      attendanceRate;
      quorumStatus;
      lastUpdated = Time.now();
    };
  };

  public func getAllShareholders(state : ShareholderState) : [Types.Shareholder] {
    state.byId.values().toArray();
  };

  public func deleteAllShareholders(state : ShareholderState) : Nat {
    let count = state.byId.size();
    state.byId.clear();
    state.byNumber.clear();
    count;
  };

  public func bulkCreateShareholders(
    state : ShareholderState,
    items : [ShareholderInput],
    importedBy : Text,
  ) : BulkCreateResult {
    var created = 0;
    var duplicates = 0;
    let errors = List.empty<Text>();
    for (item in items.values()) {
      switch (createShareholder(state, item, importedBy)) {
        case (#ok _) created += 1;
        case (#err "DUPLICATE_SHAREHOLDER_NUMBER") duplicates += 1;
        case (#err e) errors.add(e);
      };
    };
    { created; duplicates; errors = errors.toArray() };
  };

};
