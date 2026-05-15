import Map "mo:core/Map";
import List "mo:core/List";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Iter "mo:core/Iter";
import Int "mo:core/Int";
import Types "./types/agm-types";

module {

  public type Session = {
    token : Text;
    username : Text;
    role : Types.UserRole;
    expiresAt : Int;
  };

  public type LoginResponse = {
    token : Text;
    role : Types.UserRole;
    username : Text;
    mustChangePassword : Bool;
  };

  public type PasswordResetCode = {
    code : Text;
    username : Text;
    issuedBy : Text;
    issuedAt : Int;
    expiresAt : Int;
    attempts : Nat;
  };

  // ──────────────────────────────────────────────
  // Password Hashing
  // ──────────────────────────────────────────────

  /// Legacy deterministic hash kept for backward-compatible password migration.
  func legacyHashPassword(password : Text) : Text {
    let salt = "AGM2024";
    let combined = password # salt;
    var hash : Nat = 5381;
    for (c in combined.toIter()) {
      let code = Nat32.toNat(Char.toNat32(c));
      hash := ((hash * 33) + code) % 4294967296;
    };
    // produce an 8-char hex string
    let hexChars = ["0","1","2","3","4","5","6","7","8","9","a","b","c","d","e","f"];
    var remaining = hash;
    var result = "";
    for (_ in Nat.range(0, 9)) {
      let digit = remaining % 16;
      result := hexChars[digit] # result;
      remaining := remaining / 16;
    };
    result;
  };

  public func hashPassword(password : Text) : Text {
    legacyHashPassword(password);
  };

  func hashPasswordForUser(username : Text, password : Text) : Text {
    let pepper = "AGM_PRO_SECURE_V2";
    var material = username # ":" # password # ":" # pepper;
    for (round in Nat.range(0, 64)) {
      material := legacyHashPassword(material # ":" # round.toText() # ":" # username);
    };
    "v2$" # legacyHashPassword(material # ":final");
  };

  func isV2Hash(passwordHash : Text) : Bool {
    passwordHash.startsWith(#text "v2$");
  };

  func verifyPassword(user : Types.AppUser, password : Text) : Bool {
    if (isV2Hash(user.passwordHash)) {
      user.passwordHash == hashPasswordForUser(user.username, password);
    } else {
      user.passwordHash == legacyHashPassword(password);
    };
  };

  func validatePasswordPolicy(password : Text) : { #ok : (); #err : Text } {
    if (password.size() < 10) {
      return #err "PASSWORD_TOO_SHORT";
    };
    var hasLetter = false;
    var hasDigit = false;
    for (char in password.toIter()) {
      let code = Char.toNat32(char);
      if (
        (code >= Char.toNat32('a') and code <= Char.toNat32('z')) or
        (code >= Char.toNat32('A') and code <= Char.toNat32('Z'))
      ) {
        hasLetter := true;
      };
      if (code >= Char.toNat32('0') and code <= Char.toNat32('9')) {
        hasDigit := true;
      };
    };
    if (not hasLetter) {
      return #err "PASSWORD_REQUIRES_LETTER";
    };
    if (not hasDigit) {
      return #err "PASSWORD_REQUIRES_DIGIT";
    };
    #ok ();
  };

  // ──────────────────────────────────────────────
  // Initialisation
  // ──────────────────────────────────────────────

  /// Seed the default admin into the users map.
  public func initDefaultAdmin(users : Map.Map<Text, Types.AppUser>) {
    let defaultUsername = "T4N4AMEG8F5";
    switch (users.get(defaultUsername)) {
      case (?_) {}; // already seeded
      case null {
        let admin : Types.AppUser = {
          principal = "";
          username = defaultUsername;
          passwordHash = hashPasswordForUser(defaultUsername, defaultUsername);
          role = #SuperAdmin;
          isActive = true;
          mustChangePassword = false;
          createdAt = Time.now();
          lastLogin = null;
          sessionExpiry = null;
        };
        users.add(defaultUsername, admin);
      };
    };
  };

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  func generateToken(username : Text) : Text {
    let ts = Time.now();
    let tsText = ts.toText();
    let combined = tsText # ":" # username # ":TOKEN";
    hashPasswordForUser(username, combined);
  };

  func generateResetCode(username : Text) : Text {
    let seed = legacyHashPassword(username # ":" # Time.now().toText() # ":RESET");
    "RST-" # seed.toUpper();
  };

  func getSessionTimeout(agmSettings : Types.AGMSettings) : Int {
    agmSettings.sessionTimeoutMinutes * 60 * 1_000_000_000;
  };

  // ──────────────────────────────────────────────
  // Auth
  // ──────────────────────────────────────────────

  public func login(
    users : Map.Map<Text, Types.AppUser>,
    sessions : Map.Map<Text, Session>,
    agmSettings : Types.AGMSettings,
    username : Text,
    password : Text,
  ) : { #ok : LoginResponse; #err : Text } {
    switch (users.get(username)) {
      case null { #err "INVALID_CREDENTIALS" };
      case (?user) {
        if (not verifyPassword(user, password)) {
          return #err "INVALID_CREDENTIALS";
        };
        if (not user.isActive) {
          return #err "ACCOUNT_DISABLED";
        };
        let token = generateToken(username);
        let expiresAt = Time.now() + getSessionTimeout(agmSettings);
        let session : Session = {
          token;
          username;
          role = user.role;
          expiresAt;
        };
        sessions.add(token, session);
        // update lastLogin
        let migratedHash = if (isV2Hash(user.passwordHash)) {
          user.passwordHash;
        } else {
          hashPasswordForUser(username, password);
        };
        let updated : Types.AppUser = {
          user with
          lastLogin = ?Time.now();
          passwordHash = migratedHash;
          sessionExpiry = ?expiresAt;
        };
        users.add(username, updated);
        #ok {
          token;
          role = user.role;
          username;
          mustChangePassword = user.mustChangePassword;
        };
      };
    };
  };

  public func validateSession(
    sessions : Map.Map<Text, Session>,
    agmSettings : Types.AGMSettings,
    token : Text,
  ) : { #ok : Session; #err : Text } {
    switch (sessions.get(token)) {
      case null { #err "INVALID_SESSION" };
      case (?session) {
        let now = Time.now();
        if (now > session.expiresAt) {
          sessions.remove(token);
          return #err "SESSION_EXPIRED";
        };
        // sliding window renewal
        let renewed : Session = {
          session with
          expiresAt = now + getSessionTimeout(agmSettings);
        };
        sessions.add(token, renewed);
        #ok renewed;
      };
    };
  };

  public func logout(
    sessions : Map.Map<Text, Session>,
    token : Text,
  ) {
    sessions.remove(token);
  };

  public func revokeUserSessions(
    sessions : Map.Map<Text, Session>,
    username : Text,
  ) {
    let tokens = List.empty<Text>();
    for ((token, session) in sessions.entries()) {
      if (session.username == username) {
        tokens.add(token);
      };
    };
    for (token in tokens.values()) {
      sessions.remove(token);
    };
  };

  // ──────────────────────────────────────────────
  // Password Management
  // ──────────────────────────────────────────────

  public func changePassword(
    users : Map.Map<Text, Types.AppUser>,
    sessions : Map.Map<Text, Session>,
    username : Text,
    oldPassword : Text,
    newPassword : Text,
  ) : { #ok : (); #err : Text } {
    switch (users.get(username)) {
      case null { #err "USER_NOT_FOUND" };
      case (?user) {
        if (not verifyPassword(user, oldPassword)) {
          return #err "INVALID_CREDENTIALS";
        };
        switch (validatePasswordPolicy(newPassword)) {
          case (#err e) { return #err e };
          case (#ok _) {};
        };
        let updated : Types.AppUser = {
          user with
          passwordHash = hashPasswordForUser(username, newPassword);
          mustChangePassword = false;
        };
        users.add(username, updated);
        revokeUserSessions(sessions, username);
        #ok ();
      };
    };
  };

  public func issuePasswordResetCode(
    users : Map.Map<Text, Types.AppUser>,
    sessions : Map.Map<Text, Session>,
    agmSettings : Types.AGMSettings,
    resetCodes : Map.Map<Text, PasswordResetCode>,
    adminToken : Text,
    username : Text,
  ) : { #ok : PasswordResetCode; #err : Text } {
    switch (requireSuperAdmin(sessions, agmSettings, adminToken)) {
      case (#err e) { #err e };
      case (#ok session) {
        switch (users.get(username)) {
          case null { #err "USER_NOT_FOUND" };
          case (?user) {
            if (not user.isActive) {
              return #err "ACCOUNT_DISABLED";
            };
            let reset : PasswordResetCode = {
              code = generateResetCode(username);
              username;
              issuedBy = session.username;
              issuedAt = Time.now();
              expiresAt = Time.now() + (15 * 60 * 1_000_000_000);
              attempts = 0;
            };
            resetCodes.add(username, reset);
            #ok reset;
          };
        };
      };
    };
  };

  public func resetPasswordWithCode(
    users : Map.Map<Text, Types.AppUser>,
    sessions : Map.Map<Text, Session>,
    resetCodes : Map.Map<Text, PasswordResetCode>,
    username : Text,
    resetCode : Text,
    newPassword : Text,
  ) : { #ok : (); #err : Text } {
    switch (users.get(username)) {
      case null { #err "USER_NOT_FOUND" };
      case (?user) {
        switch (resetCodes.get(username)) {
          case null { return #err "INVALID_RESET_CODE" };
          case (?issued) {
            if (Time.now() > issued.expiresAt) {
              resetCodes.remove(username);
              return #err "RESET_CODE_EXPIRED";
            };
            if (issued.code != resetCode) {
              let nextAttempt = issued.attempts + 1;
              if (nextAttempt >= 5) {
                resetCodes.remove(username);
              } else {
                resetCodes.add(username, { issued with attempts = nextAttempt });
              };
              return #err "INVALID_RESET_CODE";
            };
          };
        };
        switch (validatePasswordPolicy(newPassword)) {
          case (#err e) { return #err e };
          case (#ok _) {};
        };
        let updated : Types.AppUser = {
          user with
          passwordHash = hashPasswordForUser(username, newPassword);
          mustChangePassword = false;
        };
        users.add(username, updated);
        resetCodes.remove(username);
        revokeUserSessions(sessions, username);
        #ok ();
      };
    };
  };

  // ──────────────────────────────────────────────
  // User Management
  // ──────────────────────────────────────────────

  public func requireSuperAdmin(
    sessions : Map.Map<Text, Session>,
    agmSettings : Types.AGMSettings,
    adminToken : Text,
  ) : { #ok : Session; #err : Text } {
    switch (validateSession(sessions, agmSettings, adminToken)) {
      case (#err e) { #err e };
      case (#ok session) {
        switch (session.role) {
          case (#SuperAdmin) { #ok session };
          case _ { #err "FORBIDDEN" };
        };
      };
    };
  };

  public func requireAdmin(
    sessions : Map.Map<Text, Session>,
    agmSettings : Types.AGMSettings,
    adminToken : Text,
  ) : { #ok : Session; #err : Text } {
    switch (validateSession(sessions, agmSettings, adminToken)) {
      case (#err e) { #err e };
      case (#ok session) {
        switch (session.role) {
          case (#SuperAdmin) { #ok session };
          case (#RegistrationOfficer) { #ok session };
          case _ { #err "FORBIDDEN" };
        };
      };
    };
  };

  public func requireAuthenticated(
    sessions : Map.Map<Text, Session>,
    agmSettings : Types.AGMSettings,
    token : Text,
  ) : { #ok : Session; #err : Text } {
    validateSession(sessions, agmSettings, token);
  };

  public func createUser(
    users : Map.Map<Text, Types.AppUser>,
    sessions : Map.Map<Text, Session>,
    agmSettings : Types.AGMSettings,
    adminToken : Text,
    username : Text,
    password : Text,
    role : Types.UserRole,
  ) : { #ok : Types.AppUser; #err : Text } {
    switch (requireSuperAdmin(sessions, agmSettings, adminToken)) {
      case (#err e) { #err e };
      case (#ok _) {
        if (users.containsKey(username)) {
          return #err "USERNAME_TAKEN";
        };
        let newUser : Types.AppUser = {
          principal = "";
          username;
          passwordHash = hashPasswordForUser(username, password);
          role;
          isActive = true;
          mustChangePassword = true;
          createdAt = Time.now();
          lastLogin = null;
          sessionExpiry = null;
        };
        users.add(username, newUser);
        #ok newUser;
      };
    };
  };

  public func updateUserRole(
    users : Map.Map<Text, Types.AppUser>,
    sessions : Map.Map<Text, Session>,
    agmSettings : Types.AGMSettings,
    adminToken : Text,
    username : Text,
    role : Types.UserRole,
  ) : { #ok : Types.AppUser; #err : Text } {
    switch (requireSuperAdmin(sessions, agmSettings, adminToken)) {
      case (#err e) { #err e };
      case (#ok _) {
        switch (users.get(username)) {
          case null { #err "USER_NOT_FOUND" };
          case (?user) {
            let updated : Types.AppUser = { user with role };
            users.add(username, updated);
            #ok updated;
          };
        };
      };
    };
  };

  public func deactivateUser(
    users : Map.Map<Text, Types.AppUser>,
    sessions : Map.Map<Text, Session>,
    agmSettings : Types.AGMSettings,
    adminToken : Text,
    username : Text,
  ) : { #ok : (); #err : Text } {
    switch (requireSuperAdmin(sessions, agmSettings, adminToken)) {
      case (#err e) { #err e };
      case (#ok _) {
        switch (users.get(username)) {
          case null { #err "USER_NOT_FOUND" };
          case (?user) {
            let updated : Types.AppUser = { user with isActive = false };
            users.add(username, updated);
            #ok ();
          };
        };
      };
    };
  };

  public func getUsers(
    users : Map.Map<Text, Types.AppUser>,
    sessions : Map.Map<Text, Session>,
    agmSettings : Types.AGMSettings,
    adminToken : Text,
  ) : { #ok : [Types.AppUser]; #err : Text } {
    switch (requireAdmin(sessions, agmSettings, adminToken)) {
      case (#err e) { #err e };
      case (#ok _) {
        let result = List.empty<Types.AppUser>();
        for ((_, user) in users.entries()) {
          // mask password hash
          result.add({ user with passwordHash = "" });
        };
        #ok (result.toArray());
      };
    };
  };

  public func getActiveSessions(
    _users : Map.Map<Text, Types.AppUser>,
    sessions : Map.Map<Text, Session>,
    agmSettings : Types.AGMSettings,
    adminToken : Text,
  ) : { #ok : [Session]; #err : Text } {
    switch (requireSuperAdmin(sessions, agmSettings, adminToken)) {
      case (#err e) { #err e };
      case (#ok _) {
        let now = Time.now();
        let result = List.empty<Session>();
        for ((_, s) in sessions.entries()) {
          if (s.expiresAt > now) {
            result.add(s);
          };
        };
        #ok (result.toArray());
      };
    };
  };

  public func forceLogout(
    _users : Map.Map<Text, Types.AppUser>,
    sessions : Map.Map<Text, Session>,
    agmSettings : Types.AGMSettings,
    adminToken : Text,
    username : Text,
  ) : { #ok : (); #err : Text } {
    switch (requireSuperAdmin(sessions, agmSettings, adminToken)) {
      case (#err e) { #err e };
      case (#ok _) {
        let toRemove = List.empty<Text>();
        for ((token, s) in sessions.entries()) {
          if (s.username == username) {
            toRemove.add(token);
          };
        };
        for (token in toRemove.values()) {
          sessions.remove(token);
        };
        #ok ();
      };
    };
  };

};
