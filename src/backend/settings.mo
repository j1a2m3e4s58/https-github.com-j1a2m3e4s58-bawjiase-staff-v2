import Types "./types/agm-types";
import Users "./users";
import Map "mo:core/Map";

module {

  public let defaultSettings : Types.AGMSettings = {
    agmName = "Annual General Meeting";
    agmDate = "";
    venue = "";
    quorumThreshold = 51;
    sessionTimeoutMinutes = 30;
  };

  public func getSettings(agmSettings : Types.AGMSettings) : Types.AGMSettings {
    agmSettings;
  };

  public func updateSettings(
    settingsRef : { var value : Types.AGMSettings },
    sessions : Map.Map<Text, Users.Session>,
    adminToken : Text,
    newSettings : Types.AGMSettings,
  ) : { #ok : Types.AGMSettings; #err : Text } {
    switch (Users.validateSession(sessions, settingsRef.value, adminToken)) {
      case (#err e) { #err e };
      case (#ok session) {
        switch (session.role) {
          case (#SuperAdmin) {};
          case _ { return #err "FORBIDDEN" };
        };
        if (newSettings.quorumThreshold < 1 or newSettings.quorumThreshold > 100) {
          return #err "INVALID_QUORUM_THRESHOLD";
        };
        settingsRef.value := newSettings;
        #ok newSettings;
      };
    };
  };

};
