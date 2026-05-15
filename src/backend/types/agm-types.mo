import Debug "mo:core/Debug";

module {

  // ──────────────────────────────────────────────
  // Shareholder
  // ──────────────────────────────────────────────

  public type ShareholderStatus = {
    #NotRegistered;
    #RegisteredInPerson;
    #RegisteredProxy;
    #CheckedIn;
  };

  public type Shareholder = {
    id : Text;
    shareholderNumber : Text;
    fullName : Text;
    /// Stored encrypted/masked — never returned plain to clients
    idNumber : Text;
    email : ?Text;
    phone : ?Text;
    shareholding : Nat;
    tags : [Text];
    importedAt : Int;
    importedBy : Text;
    status : ShareholderStatus;
  };

  // ──────────────────────────────────────────────
  // Registration
  // ──────────────────────────────────────────────

  public type RegistrationType = {
    #InPerson;
    #Proxy;
  };

  public type Registration = {
    id : Text;
    shareholderId : Text;
    registrationType : RegistrationType;
    proxyName : ?Text;
    proxyContact : ?Text;
    /// Object-storage key for uploaded proof document
    proxyProofKey : ?Text;
    proxyProofValidated : Bool;
    proxyFraudFlags : [Text];
    verificationCode : Text;
    registeredBy : Text;
    registeredAt : Int;
    updatedAt : Int;
    updatedBy : ?Text;
    notes : ?Text;
  };

  // ──────────────────────────────────────────────
  // Check-In
  // ──────────────────────────────────────────────

  public type CheckInMethod = {
    #QRScan;
    #ManualQuick;
    #Manual;
  };

  public type CheckIn = {
    id : Text;
    shareholderId : Text;
    registrationId : Text;
    checkedInBy : Text;
    checkedInAt : Int;
    method : CheckInMethod;
  };

  // ──────────────────────────────────────────────
  // Users & Roles
  // ──────────────────────────────────────────────

  public type UserRole = {
    #SuperAdmin;
    #RegistrationOfficer;
    #Viewer;
  };

  public type AppUser = {
    principal : Text;
    username : Text;
    passwordHash : Text;
    role : UserRole;
    isActive : Bool;
    mustChangePassword : Bool;
    createdAt : Int;
    lastLogin : ?Int;
    sessionExpiry : ?Int;
  };

  // ──────────────────────────────────────────────
  // Audit Trail
  // ──────────────────────────────────────────────

  public type AuditEntry = {
    id : Text;
    action : Text;
    entityType : Text;
    entityId : Text;
    performedBy : Text;
    performedAt : Int;
    details : Text;
    ipAddress : ?Text;
  };

  // ──────────────────────────────────────────────
  // Import
  // ──────────────────────────────────────────────

  public type ImportStatus = {
    #Pending;
    #Processing;
    #Complete;
    #Failed;
  };

  public type ImportBatch = {
    id : Text;
    filename : Text;
    uploadedBy : Text;
    uploadedAt : Int;
    totalRows : Nat;
    importedRows : Nat;
    duplicatesSkipped : Nat;
    status : ImportStatus;
  };

  public type ColumnMapping = {
    sourceColumn : Text;
    targetField : Text;
  };

  // ──────────────────────────────────────────────
  // AGM Settings
  // ──────────────────────────────────────────────

  public type AGMSettings = {
    agmName : Text;
    agmDate : Text;
    venue : Text;
    /// Quorum threshold as a whole-number percentage (e.g. 25 = 25%)
    quorumThreshold : Nat;
    sessionTimeoutMinutes : Nat;
  };

  // ──────────────────────────────────────────────
  // Dashboard Metrics
  // ──────────────────────────────────────────────

  public type DashboardMetrics = {
    totalShareholders : Nat;
    registered : Nat;
    registeredInPerson : Nat;
    registeredProxy : Nat;
    checkedIn : Nat;
    notRegistered : Nat;
    attendanceRate : Float;
    quorumStatus : Bool;
    lastUpdated : Int;
  };

};
