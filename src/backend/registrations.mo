import Map "mo:core/Map";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Types "./types/agm-types";

module {

  public type ProxyData = {
    proxyName : Text;
    proxyContact : Text;
    proxyProofKey : ?Text;
  };

  public type RegistrationUpdate = {
    notes : ?Text;
    proxyData : ?ProxyData;
    registrationType : ?Types.RegistrationType;
    verificationCode : ?Text;
  };

  // ─── State Types ─────────────────────────────────────────────────────────

  public type RegistrationState = {
    byId : Map.Map<Text, Types.Registration>;
    byShareholder : Map.Map<Text, Text>;
    pending : Map.Map<Text, Text>;
    counter : { var value : Nat };
  };

  public func newState() : RegistrationState {
    {
      byId = Map.empty<Text, Types.Registration>();
      byShareholder = Map.empty<Text, Text>();
      pending = Map.empty<Text, Text>();
      counter = { var value = 0 };
    };
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────

  let CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let CHARS_SIZE : Nat = 32;

  func charAt(seed : Nat) : Char {
    CHARS.toArray()[seed % CHARS_SIZE];
  };

  func makeCode(seed : Nat) : Text {
    "AGM-" #
    Text.fromChar(charAt(seed)) #
    Text.fromChar(charAt(seed / CHARS_SIZE)) #
    Text.fromChar(charAt(seed / (CHARS_SIZE * CHARS_SIZE))) #
    Text.fromChar(charAt(seed / (CHARS_SIZE * CHARS_SIZE * CHARS_SIZE)));
  };

  func generateVerificationCode(state : RegistrationState) : Text {
    state.counter.value += 1;
    var seed = state.counter.value;
    var candidate = makeCode(seed);
    var attempts = 0;
    while (
      attempts < 1000 and
      state.byId.values().any(func(r : Types.Registration) : Bool {
        r.verificationCode == candidate;
      })
    ) {
      seed += 1;
      candidate := makeCode(seed);
      attempts += 1;
    };
    candidate;
  };

  func generateId(state : RegistrationState) : Text {
    state.counter.value += 1;
    "reg-" # Time.now().toText() # "-" # state.counter.value.toText();
  };

  // ─── Public API ──────────────────────────────────────────────────────────

  public func registerShareholder(
    state : RegistrationState,
    shareholderId : Text,
    regType : Types.RegistrationType,
    proxyData : ?ProxyData,
    registeredBy : Text,
  ) : { #ok : Types.Registration; #err : Text } {
    if (state.pending.containsKey(shareholderId)) {
      return #err "REGISTRATION_IN_PROGRESS";
    };
    if (state.byShareholder.containsKey(shareholderId)) {
      return #err "ALREADY_REGISTERED";
    };
    state.pending.add(shareholderId, registeredBy);
    let now = Time.now();
    let id = generateId(state);
    let verCode = generateVerificationCode(state);
    let (proxyName, proxyContact, proxyProofKey) = switch proxyData {
      case (?pd) (?pd.proxyName, ?pd.proxyContact, pd.proxyProofKey);
      case null (null, null, null);
    };
    let reg : Types.Registration = {
      id;
      shareholderId;
      registrationType = regType;
      proxyName;
      proxyContact;
      proxyProofKey;
      proxyProofValidated = false;
      proxyFraudFlags = [];
      verificationCode = verCode;
      registeredBy;
      registeredAt = now;
      updatedAt = now;
      updatedBy = null;
      notes = null;
    };
    state.byId.add(id, reg);
    state.byShareholder.add(shareholderId, id);
    state.pending.remove(shareholderId);
    #ok reg;
  };

  public func getRegistration(state : RegistrationState, id : Text) : ?Types.Registration {
    state.byId.get(id);
  };

  public func getRegistrationByShareholder(state : RegistrationState, shareholderId : Text) : ?Types.Registration {
    switch (state.byShareholder.get(shareholderId)) {
      case (?regId) state.byId.get(regId);
      case null null;
    };
  };

  public func updateRegistration(
    state : RegistrationState,
    id : Text,
    updates : RegistrationUpdate,
    updatedBy : Text,
  ) : { #ok : Types.Registration; #err : Text } {
    switch (state.byId.get(id)) {
      case null #err "NOT_FOUND";
      case (?reg) {
        let nextRegistrationType = switch (updates.registrationType) {
          case (?kind) kind;
          case null reg.registrationType;
        };
        let (newProxyName, newProxyContact, newProxyProofKey) = switch (nextRegistrationType, updates.proxyData) {
          case (#InPerson, _) (null, null, null);
          case (#Proxy, ?pd) (?pd.proxyName, ?pd.proxyContact, pd.proxyProofKey);
          case (#Proxy, null) (reg.proxyName, reg.proxyContact, reg.proxyProofKey);
        };
        let updated : Types.Registration = {
          reg with
          notes = switch (updates.notes) { case (?n) ?n; case null reg.notes };
          registrationType = nextRegistrationType;
          proxyName = newProxyName;
          proxyContact = newProxyContact;
          proxyProofKey = newProxyProofKey;
          verificationCode = switch (updates.verificationCode) {
            case (?code) code;
            case null reg.verificationCode;
          };
          updatedAt = Time.now();
          updatedBy = ?updatedBy;
        };
        state.byId.add(id, updated);
        #ok updated;
      };
    };
  };

  public func validateProxyProof(
    state : RegistrationState,
    registrationId : Text,
    validated : Bool,
    fraudFlags : [Text],
    validatedBy : Text,
  ) : { #ok : Types.Registration; #err : Text } {
    switch (state.byId.get(registrationId)) {
      case null #err "NOT_FOUND";
      case (?reg) {
        let updated : Types.Registration = {
          reg with
          proxyProofValidated = validated;
          proxyFraudFlags = fraudFlags;
          updatedAt = Time.now();
          updatedBy = ?validatedBy;
        };
        state.byId.add(registrationId, updated);
        #ok updated;
      };
    };
  };

  public func cancelRegistration(
    state : RegistrationState,
    id : Text,
    cancelledBy : Text,
    reason : Text,
  ) : { #ok : Text; #err : Text } {
    switch (state.byId.get(id)) {
      case null #err "NOT_FOUND";
      case (?reg) {
        state.byShareholder.remove(reg.shareholderId);
        state.byId.remove(id);
        ignore (cancelledBy, reason);
        #ok (reg.shareholderId);
      };
    };
  };

  public func getAllRegistrations(state : RegistrationState) : [Types.Registration] {
    state.byId.values().toArray();
  };

};
