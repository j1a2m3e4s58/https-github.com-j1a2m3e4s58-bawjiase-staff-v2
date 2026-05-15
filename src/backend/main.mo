import List "mo:core/List";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import AccessControl "mo:caffeineai-authorization/access-control";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import MixinObjectStorage "mo:caffeineai-object-storage/Mixin";
import Types "types/core-users-auth";
import CoreUsersAuthApi "mixins/core-users-auth-api";
import AnnouncementTypes "types/announcements-polls-notifications-forms";
import AnnouncementsApi "mixins/announcements-polls-notifications-forms-api";
import AgmShareholders "./shareholders";
import AgmRegistrations "./registrations";
import AgmCheckIns "./checkins";
import AgmImports "./imports";
import AgmAudit "./audit";
import AgmTypes "types/agm-types";
import AgmUsers "./users";
import AgmSettings "./settings";

actor {
  // Authorization state (managed by MixinAuthorization)
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // Object storage (managed by MixinObjectStorage)
  include MixinObjectStorage();

  // Core users & auth state
  let users = List.empty<Types.UserInternal>();
  let auditLogs = List.empty<Types.AuditLog>();
  let nextAuditIdCounter : { var value : Nat } = { var value = 0 };
  let resetTokens = Map.empty<Text, (Principal, Int)>();

  include CoreUsersAuthApi(
    accessControlState,
    users,
    auditLogs,
    nextAuditIdCounter,
    resetTokens,
  );

  // Announcements / polls / notifications / forms state
  let nextIdCounter : { var value : Nat } = { var value = 0 };
  let announcements = List.empty<AnnouncementTypes.Announcement>();
  let polls = List.empty<AnnouncementTypes.Poll>();
  let pollOptions = List.empty<AnnouncementTypes.PollOption>();
  let pollVotes = List.empty<AnnouncementTypes.PollVote>();
  let hiddenAnnouncements = List.empty<AnnouncementTypes.HiddenAnnouncement>();
  let notifications = List.empty<AnnouncementTypes.Notification>();
  let forms = List.empty<AnnouncementTypes.Form>();

  include AnnouncementsApi(
    announcements,
    polls,
    pollOptions,
    pollVotes,
    hiddenAnnouncements,
    notifications,
    forms,
    nextIdCounter,
  );

  // AGM state imported from agm-pro-main
  let agmAdminUsers = Map.empty<Text, AgmTypes.AppUser>();
  let agmAdminSessions = Map.empty<Text, AgmUsers.Session>();
  let agmPasswordResetCodes = Map.empty<Text, AgmUsers.PasswordResetCode>();
  var agmAuthSettings = AgmSettings.defaultSettings;

  type AgmYearState = {
    settingsRef : { var value : AgmTypes.AGMSettings };
    shareholderState : AgmShareholders.ShareholderState;
    registrationState : AgmRegistrations.RegistrationState;
    checkInState : AgmCheckIns.CheckInState;
    importState : AgmImports.ImportState;
    auditState : AgmAudit.AuditState;
  };

  let agmYearStates = Map.empty<Text, AgmYearState>();

  func normalizeAgmYear(year : Text) : Text {
    if (year == "") "2026" else year;
  };

  func createAgmYearState() : AgmYearState {
    {
      settingsRef = { var value = AgmSettings.defaultSettings };
      shareholderState = AgmShareholders.newState();
      registrationState = AgmRegistrations.newState();
      checkInState = AgmCheckIns.newState();
      importState = AgmImports.newState();
      auditState = AgmAudit.newState();
    };
  };

  func ensureAgmYearState(year : Text) : AgmYearState {
    let normalizedYear = normalizeAgmYear(year);
    switch (agmYearStates.get(normalizedYear)) {
      case (?state) state;
      case null {
        let state = createAgmYearState();
        agmYearStates.add(normalizedYear, state);
        state;
      };
    };
  };

  func peekAgmYearState(year : Text) : AgmYearState {
    let normalizedYear = normalizeAgmYear(year);
    switch (agmYearStates.get(normalizedYear)) {
      case (?state) state;
      case null createAgmYearState();
    };
  };

  AgmUsers.initDefaultAdmin(agmAdminUsers);

  func requireAgmOfficerSession(token : Text) : { #ok : AgmUsers.Session; #err : Text } {
    AgmUsers.requireAdmin(agmAdminSessions, agmAuthSettings, token);
  };

  func requireAgmSuperAdminSession(token : Text) : { #ok : AgmUsers.Session; #err : Text } {
    AgmUsers.requireSuperAdmin(agmAdminSessions, agmAuthSettings, token);
  };

  func requireAgmAuthenticatedSession(token : Text) : { #ok : AgmUsers.Session; #err : Text } {
    AgmUsers.requireAuthenticated(agmAdminSessions, agmAuthSettings, token);
  };

  func redactAgmShareholder(
    shareholder : AgmTypes.Shareholder,
    session : AgmUsers.Session,
  ) : AgmTypes.Shareholder {
    switch (session.role) {
      case (#SuperAdmin) shareholder;
      case _ {
        {
          shareholder with
          idNumber = "REDACTED";
          email = null;
          phone = null;
        };
      };
    };
  };

  func redactAgmSearchResult(
    result : AgmShareholders.SearchResult,
    session : AgmUsers.Session,
  ) : AgmShareholders.SearchResult {
    {
      result with
      items = result.items.map(func(item) { redactAgmShareholder(item, session) });
    };
  };

  public func agmLogin(
    username : Text,
    password : Text,
  ) : async { #ok : AgmUsers.LoginResponse; #err : Text } {
    AgmUsers.login(agmAdminUsers, agmAdminSessions, agmAuthSettings, username, password);
  };

  public func agmValidateSession(token : Text) : async { #ok : AgmUsers.Session; #err : Text } {
    AgmUsers.validateSession(agmAdminSessions, agmAuthSettings, token);
  };

  public func agmLogout(token : Text) : async () {
    AgmUsers.logout(agmAdminSessions, token);
  };

  public func agmChangePassword(
    username : Text,
    oldPassword : Text,
    newPassword : Text,
  ) : async { #ok : (); #err : Text } {
    AgmUsers.changePassword(agmAdminUsers, agmAdminSessions, username, oldPassword, newPassword);
  };

  public func agmResetPasswordWithCode(
    username : Text,
    resetCode : Text,
    newPassword : Text,
  ) : async { #ok : (); #err : Text } {
    AgmUsers.resetPasswordWithCode(
      agmAdminUsers,
      agmAdminSessions,
      agmPasswordResetCodes,
      username,
      resetCode,
      newPassword,
    );
  };

  public func agmChangePasswordSecure(
    token : Text,
    oldPassword : Text,
    newPassword : Text,
  ) : async { #ok : (); #err : Text } {
    switch (requireAgmAuthenticatedSession(token)) {
      case (#err e) { #err e };
      case (#ok session) {
        AgmUsers.changePassword(
          agmAdminUsers,
          agmAdminSessions,
          session.username,
          oldPassword,
          newPassword,
        );
      };
    };
  };

  public func agmCreatePasswordResetCode(
    adminToken : Text,
    username : Text,
  ) : async { #ok : AgmUsers.PasswordResetCode; #err : Text } {
    AgmUsers.issuePasswordResetCode(
      agmAdminUsers,
      agmAdminSessions,
      agmAuthSettings,
      agmPasswordResetCodes,
      adminToken,
      username,
    );
  };

  public func agmCreateUser(
    adminToken : Text,
    username : Text,
    password : Text,
    role : AgmTypes.UserRole,
  ) : async { #ok : AgmTypes.AppUser; #err : Text } {
    AgmUsers.createUser(
      agmAdminUsers,
      agmAdminSessions,
      agmAuthSettings,
      adminToken,
      username,
      password,
      role,
    );
  };

  public func agmUpdateUserRole(
    adminToken : Text,
    username : Text,
    role : AgmTypes.UserRole,
  ) : async { #ok : AgmTypes.AppUser; #err : Text } {
    AgmUsers.updateUserRole(
      agmAdminUsers,
      agmAdminSessions,
      agmAuthSettings,
      adminToken,
      username,
      role,
    );
  };

  public func agmDeactivateUser(
    adminToken : Text,
    username : Text,
  ) : async { #ok : (); #err : Text } {
    AgmUsers.deactivateUser(
      agmAdminUsers,
      agmAdminSessions,
      agmAuthSettings,
      adminToken,
      username,
    );
  };

  public func agmGetUsers(adminToken : Text) : async { #ok : [AgmTypes.AppUser]; #err : Text } {
    AgmUsers.getUsers(agmAdminUsers, agmAdminSessions, agmAuthSettings, adminToken);
  };

  public func agmGetActiveSessions(
    adminToken : Text,
  ) : async { #ok : [AgmUsers.Session]; #err : Text } {
    AgmUsers.getActiveSessions(agmAdminUsers, agmAdminSessions, agmAuthSettings, adminToken);
  };

  public func agmForceLogout(
    adminToken : Text,
    username : Text,
  ) : async { #ok : (); #err : Text } {
    AgmUsers.forceLogout(
      agmAdminUsers,
      agmAdminSessions,
      agmAuthSettings,
      adminToken,
      username,
    );
  };

  public query func agmGetSettings(year : Text) : async AgmTypes.AGMSettings {
    let yearState = peekAgmYearState(year);
    AgmSettings.getSettings(yearState.settingsRef.value);
  };

  public func agmUpdateSettings(
    year : Text,
    adminToken : Text,
    newSettings : AgmTypes.AGMSettings,
  ) : async { #ok : AgmTypes.AGMSettings; #err : Text } {
    let yearState = ensureAgmYearState(year);
    let result = AgmSettings.updateSettings(
      yearState.settingsRef,
      agmAdminSessions,
      adminToken,
      newSettings,
    );
    switch (result) {
      case (#ok settings) {
        agmAuthSettings := {
          agmAuthSettings with
          sessionTimeoutMinutes = settings.sessionTimeoutMinutes;
        };
      };
      case (#err _) {};
    };
    result;
  };

  public shared func agmCreateShareholder(
    year : Text,
    data : AgmShareholders.ShareholderInput,
    importedBy : Text,
  ) : async { #ok : AgmTypes.Shareholder; #err : Text } {
    switch (requireAgmOfficerSession(importedBy)) {
      case (#err e) { #err e };
      case (#ok session) {
        let yearState = ensureAgmYearState(year);
        let result = AgmShareholders.createShareholder(
          yearState.shareholderState,
          data,
          session.username,
        );
        ignore AgmAudit.logAction(
          yearState.auditState,
          "CREATE_SHAREHOLDER",
          "shareholder",
          switch result { case (#ok s) s.id; case (#err _) "" },
          session.username,
          "Shareholder created: " # data.shareholderNumber,
        );
        result;
      };
    };
  };

  public query func agmGetShareholder(year : Text, id : Text) : async ?AgmTypes.Shareholder {
    let yearState = peekAgmYearState(year);
    AgmShareholders.getShareholder(yearState.shareholderState, id);
  };

  public func agmGetShareholderSecure(
    year : Text,
    token : Text,
    id : Text,
  ) : async { #ok : ?AgmTypes.Shareholder; #err : Text } {
    switch (requireAgmAuthenticatedSession(token)) {
      case (#err e) { #err e };
      case (#ok session) {
        let yearState = ensureAgmYearState(year);
        #ok (
          switch (AgmShareholders.getShareholder(yearState.shareholderState, id)) {
            case null null;
            case (?shareholder) ?redactAgmShareholder(shareholder, session);
          }
        );
      };
    };
  };

  public query func agmGetShareholderByNumber(
    year : Text,
    shareholderNumber : Text,
  ) : async ?AgmTypes.Shareholder {
    let yearState = peekAgmYearState(year);
    AgmShareholders.getShareholderByNumber(yearState.shareholderState, shareholderNumber);
  };

  public func agmGetShareholderByNumberSecure(
    year : Text,
    token : Text,
    shareholderNumber : Text,
  ) : async { #ok : ?AgmTypes.Shareholder; #err : Text } {
    switch (requireAgmAuthenticatedSession(token)) {
      case (#err e) { #err e };
      case (#ok session) {
        #ok (
          switch (
            AgmShareholders.getShareholderByNumber(
              ensureAgmYearState(year).shareholderState,
              shareholderNumber,
            )
          ) {
            case null null;
            case (?shareholder) ?redactAgmShareholder(shareholder, session);
          }
        );
      };
    };
  };

  public query func agmSearchShareholders(
    year : Text,
    searchQuery : Text,
    statusFilter : ?AgmTypes.ShareholderStatus,
    page : Nat,
    pageSize : Nat,
  ) : async AgmShareholders.SearchResult {
    let yearState = peekAgmYearState(year);
    AgmShareholders.searchShareholders(
      yearState.shareholderState,
      searchQuery,
      statusFilter,
      page,
      pageSize,
    );
  };

  public func agmSearchShareholdersSecure(
    year : Text,
    token : Text,
    searchQuery : Text,
    statusFilter : ?AgmTypes.ShareholderStatus,
    page : Nat,
    pageSize : Nat,
  ) : async { #ok : AgmShareholders.SearchResult; #err : Text } {
    switch (requireAgmAuthenticatedSession(token)) {
      case (#err e) { #err e };
      case (#ok session) {
        let yearState = ensureAgmYearState(year);
        #ok (
          redactAgmSearchResult(
            AgmShareholders.searchShareholders(
              yearState.shareholderState,
              searchQuery,
              statusFilter,
              page,
              pageSize,
            ),
            session,
          )
        );
      };
    };
  };

  public shared func agmUpdateShareholderStatus(
    year : Text,
    id : Text,
    status : AgmTypes.ShareholderStatus,
    updatedBy : Text,
  ) : async { #ok : AgmTypes.Shareholder; #err : Text } {
    switch (requireAgmOfficerSession(updatedBy)) {
      case (#err e) { #err e };
      case (#ok session) {
        let yearState = ensureAgmYearState(year);
        let result = AgmShareholders.updateShareholderStatus(
          yearState.shareholderState,
          id,
          status,
          session.username,
        );
        ignore AgmAudit.logAction(
          yearState.auditState,
          "UPDATE_STATUS",
          "shareholder",
          id,
          session.username,
          "Status updated",
        );
        result;
      };
    };
  };

  public shared func agmUpdateShareholderContact(
    year : Text,
    id : Text,
    phone : ?Text,
    idNumber : Text,
    updatedBy : Text,
  ) : async { #ok : AgmTypes.Shareholder; #err : Text } {
    switch (requireAgmOfficerSession(updatedBy)) {
      case (#err e) { #err e };
      case (#ok session) {
        let yearState = ensureAgmYearState(year);
        let result = AgmShareholders.updateShareholderContact(
          yearState.shareholderState,
          id,
          phone,
          idNumber,
          session.username,
        );
        ignore AgmAudit.logAction(
          yearState.auditState,
          "UPDATE_SHAREHOLDER_CONTACT",
          "shareholder",
          id,
          session.username,
          "Updated AGM shareholder contact details",
        );
        result;
      };
    };
  };

  public query func agmGetDashboardMetrics(
    year : Text,
    quorumThreshold : Nat,
  ) : async AgmTypes.DashboardMetrics {
    let yearState = peekAgmYearState(year);
    AgmShareholders.getDashboardMetrics(yearState.shareholderState, quorumThreshold);
  };

  public query func agmGetAllShareholders(year : Text) : async [AgmTypes.Shareholder] {
    let yearState = peekAgmYearState(year);
    AgmShareholders.getAllShareholders(yearState.shareholderState);
  };

  public func agmGetAllShareholdersSecure(
    year : Text,
    token : Text,
  ) : async { #ok : [AgmTypes.Shareholder]; #err : Text } {
    switch (requireAgmAuthenticatedSession(token)) {
      case (#err e) { #err e };
      case (#ok session) {
        #ok (
          AgmShareholders.getAllShareholders(ensureAgmYearState(year).shareholderState).map(func(item) {
            redactAgmShareholder(item, session);
          })
        );
      };
    };
  };

  public shared func agmDeleteAllShareholders(
    year : Text,
    deletedBy : Text,
  ) : async { #ok : Nat; #err : Text } {
    switch (requireAgmSuperAdminSession(deletedBy)) {
      case (#err e) { #err e };
      case (#ok session) {
        let yearState = ensureAgmYearState(year);
        let count = AgmShareholders.deleteAllShareholders(yearState.shareholderState);
        ignore AgmAudit.logAction(
          yearState.auditState,
          "DELETE_ALL_SHAREHOLDERS",
          "shareholder",
          "*",
          session.username,
          "All shareholders deleted. Count: " # count.toText(),
        );
        #ok count;
      };
    };
  };

  public shared func agmBulkCreateShareholders(
    year : Text,
    items : [AgmShareholders.ShareholderInput],
    importedBy : Text,
  ) : async AgmShareholders.BulkCreateResult {
    switch (requireAgmOfficerSession(importedBy)) {
      case (#err _) {
        { created = 0; duplicates = 0; errors = ["FORBIDDEN"] };
      };
      case (#ok session) {
        let yearState = ensureAgmYearState(year);
        let result = AgmShareholders.bulkCreateShareholders(
          yearState.shareholderState,
          items,
          session.username,
        );
        ignore AgmAudit.logAction(
          yearState.auditState,
          "BULK_IMPORT",
          "shareholder",
          "batch",
          session.username,
          "Bulk import: created=" # result.created.toText() #
          " duplicates=" # result.duplicates.toText(),
        );
        result;
      };
    };
  };

  public func agmRegisterShareholder(
    year : Text,
    shareholderId : Text,
    regType : AgmTypes.RegistrationType,
    proxyData : ?AgmRegistrations.ProxyData,
    registeredBy : Text,
  ) : async { #ok : AgmTypes.Registration; #err : Text } {
    switch (requireAgmOfficerSession(registeredBy)) {
      case (#err e) { #err e };
      case (#ok session) {
        let yearState = ensureAgmYearState(year);
        let result = AgmRegistrations.registerShareholder(
          yearState.registrationState,
          shareholderId,
          regType,
          proxyData,
          session.username,
        );
        switch (result) {
          case (#ok reg) {
            let newStatus : AgmTypes.ShareholderStatus = switch (regType) {
              case (#InPerson) #RegisteredInPerson;
              case (#Proxy) #RegisteredProxy;
            };
            ignore AgmShareholders.updateShareholderStatus(
              yearState.shareholderState,
              shareholderId,
              newStatus,
              session.username,
            );
            ignore AgmAudit.logAction(
              yearState.auditState,
              "REGISTER_SHAREHOLDER",
              "registration",
              reg.id,
              session.username,
              "Registered: " # reg.verificationCode,
            );
          };
          case _ {};
        };
        result;
      };
    };
  };

  public query func agmGetRegistration(year : Text, id : Text) : async ?AgmTypes.Registration {
    let yearState = peekAgmYearState(year);
    AgmRegistrations.getRegistration(yearState.registrationState, id);
  };

  public query func agmGetRegistrationByShareholder(
    year : Text,
    shareholderId : Text,
  ) : async ?AgmTypes.Registration {
    let yearState = peekAgmYearState(year);
    AgmRegistrations.getRegistrationByShareholder(yearState.registrationState, shareholderId);
  };

  public func agmUpdateRegistration(
    year : Text,
    id : Text,
    updates : AgmRegistrations.RegistrationUpdate,
    updatedBy : Text,
  ) : async { #ok : AgmTypes.Registration; #err : Text } {
    switch (requireAgmOfficerSession(updatedBy)) {
      case (#err e) { #err e };
      case (#ok session) {
        let yearState = ensureAgmYearState(year);
        let result = AgmRegistrations.updateRegistration(
          yearState.registrationState,
          id,
          updates,
          session.username,
        );
        switch (result) {
          case (#ok reg) {
            ignore AgmAudit.logAction(
              yearState.auditState,
              "UPDATE_REGISTRATION",
              "registration",
              reg.id,
              session.username,
              "Registration updated",
            );
          };
          case _ {};
        };
        result;
      };
    };
  };

  public func agmValidateProxyProof(
    year : Text,
    registrationId : Text,
    validated : Bool,
    fraudFlags : [Text],
    validatedBy : Text,
  ) : async { #ok : AgmTypes.Registration; #err : Text } {
    switch (requireAgmOfficerSession(validatedBy)) {
      case (#err e) { #err e };
      case (#ok session) {
        let yearState = ensureAgmYearState(year);
        let result = AgmRegistrations.validateProxyProof(
          yearState.registrationState,
          registrationId,
          validated,
          fraudFlags,
          session.username,
        );
        switch (result) {
          case (#ok reg) {
            ignore AgmAudit.logAction(
              yearState.auditState,
              "VALIDATE_PROXY",
              "registration",
              reg.id,
              session.username,
              "Proxy validated: " # debug_show(validated),
            );
          };
          case _ {};
        };
        result;
      };
    };
  };

  public func agmCancelRegistration(
    year : Text,
    id : Text,
    cancelledBy : Text,
    reason : Text,
  ) : async { #ok; #err : Text } {
    switch (requireAgmOfficerSession(cancelledBy)) {
      case (#err e) { #err e };
      case (#ok session) {
        let yearState = ensureAgmYearState(year);
        switch (
          AgmRegistrations.cancelRegistration(
            yearState.registrationState,
            id,
            session.username,
            reason,
          )
        ) {
          case (#ok shareholderId) {
            ignore AgmShareholders.updateShareholderStatus(
              yearState.shareholderState,
              shareholderId,
              #NotRegistered,
              session.username,
            );
            ignore AgmAudit.logAction(
              yearState.auditState,
              "CANCEL_REGISTRATION",
              "registration",
              id,
              session.username,
              "Cancelled: " # reason,
            );
            #ok;
          };
          case (#err e) #err e;
        };
      };
    };
  };

  public query func agmGetAllRegistrations(year : Text) : async [AgmTypes.Registration] {
    let yearState = peekAgmYearState(year);
    AgmRegistrations.getAllRegistrations(yearState.registrationState);
  };

  public func agmCheckInShareholder(
    year : Text,
    shareholderId : Text,
    registrationId : Text,
    method : AgmTypes.CheckInMethod,
    checkedInBy : Text,
  ) : async { #ok : AgmTypes.CheckIn; #err : Text } {
    switch (requireAgmOfficerSession(checkedInBy)) {
      case (#err e) { #err e };
      case (#ok session) {
        let yearState = ensureAgmYearState(year);
        let regExists = switch (AgmRegistrations.getRegistration(yearState.registrationState, registrationId)) {
          case (?reg) reg.shareholderId == shareholderId;
          case null false;
        };
        let result = AgmCheckIns.checkInShareholder(
          yearState.checkInState,
          shareholderId,
          registrationId,
          regExists,
          method,
          session.username,
        );
        switch (result) {
          case (#ok checkIn) {
            ignore AgmShareholders.updateShareholderStatus(
              yearState.shareholderState,
              shareholderId,
              #CheckedIn,
              session.username,
            );
            ignore AgmAudit.logAction(
              yearState.auditState,
              "CHECK_IN",
              "checkin",
              checkIn.id,
              session.username,
              "Checked in via " # debug_show(method),
            );
          };
          case _ {};
        };
        result;
      };
    };
  };

  public query func agmGetCheckIn(year : Text, id : Text) : async ?AgmTypes.CheckIn {
    let yearState = peekAgmYearState(year);
    AgmCheckIns.getCheckIn(yearState.checkInState, id);
  };

  public query func agmGetCheckInByShareholder(
    year : Text,
    shareholderId : Text,
  ) : async ?AgmTypes.CheckIn {
    let yearState = peekAgmYearState(year);
    AgmCheckIns.getCheckInByShareholder(yearState.checkInState, shareholderId);
  };

  public func agmUndoCheckIn(
    year : Text,
    shareholderId : Text,
    undoneBy : Text,
  ) : async { #ok; #err : Text } {
    switch (requireAgmOfficerSession(undoneBy)) {
      case (#err e) { #err e };
      case (#ok session) {
        let yearState = ensureAgmYearState(year);
        let result = AgmCheckIns.undoCheckIn(
          yearState.checkInState,
          shareholderId,
          session.username,
        );
        switch (result) {
          case (#ok) {
            let prevStatus : AgmTypes.ShareholderStatus = switch (
              AgmRegistrations.getRegistrationByShareholder(
                yearState.registrationState,
                shareholderId,
              )
            ) {
              case (?reg) switch (reg.registrationType) {
                case (#InPerson) #RegisteredInPerson;
                case (#Proxy) #RegisteredProxy;
              };
              case null #NotRegistered;
            };
            ignore AgmShareholders.updateShareholderStatus(
              yearState.shareholderState,
              shareholderId,
              prevStatus,
              session.username,
            );
            ignore AgmAudit.logAction(
              yearState.auditState,
              "UNDO_CHECK_IN",
              "checkin",
              shareholderId,
              session.username,
              "Check-in undone",
            );
          };
          case _ {};
        };
        result;
      };
    };
  };

  public query func agmGetAllCheckIns(year : Text) : async [AgmTypes.CheckIn] {
    let yearState = peekAgmYearState(year);
    AgmCheckIns.getAllCheckIns(yearState.checkInState);
  };

  public shared func agmCreateImportBatch(
    year : Text,
    filename : Text,
    uploadedBy : Text,
    totalRows : Nat,
  ) : async AgmTypes.ImportBatch {
    switch (requireAgmOfficerSession(uploadedBy)) {
      case (#err _) {
        {
          id = "";
          filename;
          uploadedBy = "";
          uploadedAt = 0;
          totalRows;
          importedRows = 0;
          duplicatesSkipped = 0;
          status = #Failed;
        };
      };
      case (#ok session) {
        let yearState = ensureAgmYearState(year);
        let batch = AgmImports.createImportBatch(
          yearState.importState,
          filename,
          session.username,
          totalRows,
        );
        ignore AgmAudit.logAction(
          yearState.auditState,
          "CREATE_IMPORT_BATCH",
          "import",
          batch.id,
          session.username,
          "Import batch created: " # filename,
        );
        batch;
      };
    };
  };

  public shared func agmUpdateImportBatchStatus(
    year : Text,
    id : Text,
    status : AgmTypes.ImportStatus,
    importedRows : Nat,
    duplicates : Nat,
  ) : async { #ok : AgmTypes.ImportBatch; #err : Text } {
    let yearState = ensureAgmYearState(year);
    AgmImports.updateImportBatchStatus(
      yearState.importState,
      id,
      status,
      importedRows,
      duplicates,
    );
  };

  public query func agmGetImportBatch(year : Text, id : Text) : async ?AgmTypes.ImportBatch {
    let yearState = peekAgmYearState(year);
    AgmImports.getImportBatch(yearState.importState, id);
  };

  public query func agmGetImportBatches(year : Text) : async [AgmTypes.ImportBatch] {
    let yearState = peekAgmYearState(year);
    AgmImports.getImportBatches(yearState.importState);
  };

  public query func agmGetAuditLog(
    year : Text,
    entityType : ?Text,
    entityId : ?Text,
    limit : Nat,
  ) : async [AgmTypes.AuditEntry] {
    let yearState = peekAgmYearState(year);
    AgmAudit.getAuditLog(yearState.auditState, entityType, entityId, limit);
  };

  public query func agmGetAuditLogForExport(year : Text) : async [AgmTypes.AuditEntry] {
    let yearState = peekAgmYearState(year);
    AgmAudit.getAuditLogForExport(yearState.auditState);
  };
};
