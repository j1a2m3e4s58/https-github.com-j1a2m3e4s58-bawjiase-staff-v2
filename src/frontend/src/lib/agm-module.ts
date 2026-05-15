export interface AgmBranchTurnout {
  branch: string;
  registered: number;
  checkedIn: number;
}

export interface AgmRecentRegistration {
  name: string;
  type: "In Person" | "Proxy";
  branch: string;
  time: string;
}

export interface AgmBoardHighlight {
  label: string;
  value: string;
}

export type AgmRegistrationType = "In Person" | "Proxy" | "Not Registered";

export interface AgmShareholderRecord {
  id: string;
  fullName: string;
  shareholderNumber: string;
  branch: string;
  shareholding: number;
  phone: string;
  ghanaCardId: string;
  registrationType: AgmRegistrationType;
  verificationCode: string;
  registeredBy: string;
  registeredAt: string | null;
  checkedInAt: string | null;
  proxyName?: string;
  proxyPhone?: string;
}

export interface AgmImportBatchRecord {
  id: string;
  filename: string;
  branch: string;
  importedAt: string;
  importedRows: number;
  duplicateRows: number;
  errorRows: number;
  status: "Completed" | "Completed With Issues";
  operatorName: string;
}

export interface AgmSettingsRecord {
  agmName: string;
  venue: string;
  agmDate: string;
  quorumRequiredPct: number;
}

export interface AgmOperatorActivityRecord {
  id: string;
  operatorName: string;
  action: string;
  target: string;
  branch: string;
  timestamp: string;
}

export const AGM_ACTIVE_YEAR = "2026";
export const AGM_BRANCH_OPTIONS = [
  "Head Office",
  "Bawjiase",
  "Adeiso",
  "Ofaakor",
  "Kasoa New Market",
  "Kasoa Main",
] as const;

export const AGM_SUMMARY = {
  agmName: "Bawjiase Community Bank 9th Annual General Meeting",
  venue: "Bawjiase Civic Centre",
  agmDate: "Saturday, 22 June 2026",
  quorumRequiredPct: 50,
  totalShareholders: 1284,
  registered: 968,
  inPerson: 712,
  proxy: 256,
  checkedIn: 844,
};

export const AGM_BRANCH_TURNOUT: AgmBranchTurnout[] = [
  { branch: "Head Office", registered: 274, checkedIn: 241 },
  { branch: "Bawjiase", registered: 198, checkedIn: 181 },
  { branch: "Kasoa Main", registered: 172, checkedIn: 147 },
  { branch: "Kasoa New Market", registered: 126, checkedIn: 103 },
  { branch: "Adeiso", registered: 112, checkedIn: 96 },
  { branch: "Ofaakor", registered: 86, checkedIn: 76 },
];

export const AGM_RECENT_REGISTRATIONS: AgmRecentRegistration[] = [
  { name: "Esi Nyarko", type: "In Person", branch: "Head Office", time: "2 min ago" },
  { name: "Yaw Boadu", type: "Proxy", branch: "Kasoa Main", time: "5 min ago" },
  { name: "Charlotte Owusu", type: "In Person", branch: "Bawjiase", time: "9 min ago" },
  { name: "Kwesi Ayitey", type: "Proxy", branch: "Adeiso", time: "13 min ago" },
  { name: "Mabel Mensah", type: "In Person", branch: "Ofaakor", time: "16 min ago" },
];

export const AGM_BOARD_HIGHLIGHTS: AgmBoardHighlight[] = [
  { label: "Attendance rate", value: "65.7%" },
  { label: "Quorum status", value: "Reached" },
  { label: "Proxy participation", value: "26.4%" },
  { label: "Top branch turnout", value: "Head Office" },
];

export const AGM_SHAREHOLDERS: AgmShareholderRecord[] = [
  {
    id: "agm-1",
    fullName: "Esi Nyarko",
    shareholderNumber: "SH-00214",
    branch: "Head Office",
    shareholding: 2400,
    phone: "024 455 7721",
    ghanaCardId: "GHA-884211-9",
    registrationType: "In Person",
    verificationCode: "AGM-2401",
    registeredBy: "Front Desk A",
    registeredAt: "2026-05-14 08:14",
    checkedInAt: "2026-05-14 08:37",
  },
  {
    id: "agm-2",
    fullName: "Yaw Boadu",
    shareholderNumber: "SH-01052",
    branch: "Kasoa Main",
    shareholding: 1780,
    phone: "020 114 3328",
    ghanaCardId: "GHA-552400-2",
    registrationType: "Proxy",
    verificationCode: "AGM-2417",
    registeredBy: "Front Desk B",
    registeredAt: "2026-05-14 08:26",
    checkedInAt: "2026-05-14 08:44",
    proxyName: "Abena Boadu",
    proxyPhone: "054 882 1904",
  },
  {
    id: "agm-3",
    fullName: "Charlotte Owusu",
    shareholderNumber: "SH-00591",
    branch: "Bawjiase",
    shareholding: 3110,
    phone: "055 290 0048",
    ghanaCardId: "GHA-221804-6",
    registrationType: "In Person",
    verificationCode: "AGM-2423",
    registeredBy: "Front Desk A",
    registeredAt: "2026-05-14 08:33",
    checkedInAt: null,
  },
  {
    id: "agm-4",
    fullName: "Kwesi Ayitey",
    shareholderNumber: "SH-00672",
    branch: "Adeiso",
    shareholding: 920,
    phone: "024 118 9086",
    ghanaCardId: "GHA-118620-0",
    registrationType: "Proxy",
    verificationCode: "AGM-2431",
    registeredBy: "Proxy Desk",
    registeredAt: "2026-05-14 08:38",
    checkedInAt: "2026-05-14 08:58",
    proxyName: "Kojo Ayitey",
    proxyPhone: "059 310 0881",
  },
  {
    id: "agm-5",
    fullName: "Mabel Mensah",
    shareholderNumber: "SH-00991",
    branch: "Ofaakor",
    shareholding: 1360,
    phone: "024 700 1122",
    ghanaCardId: "GHA-903117-4",
    registrationType: "In Person",
    verificationCode: "AGM-2438",
    registeredBy: "Front Desk C",
    registeredAt: "2026-05-14 08:41",
    checkedInAt: null,
  },
  {
    id: "agm-6",
    fullName: "Richard Antwi",
    shareholderNumber: "SH-01108",
    branch: "Kasoa New Market",
    shareholding: 680,
    phone: "020 550 7811",
    ghanaCardId: "GHA-552701-3",
    registrationType: "Not Registered",
    verificationCode: "",
    registeredBy: "",
    registeredAt: null,
    checkedInAt: null,
  },
  {
    id: "agm-7",
    fullName: "Priscilla Tetteh",
    shareholderNumber: "SH-01377",
    branch: "Head Office",
    shareholding: 4200,
    phone: "055 411 9943",
    ghanaCardId: "GHA-778220-5",
    registrationType: "Not Registered",
    verificationCode: "",
    registeredBy: "",
    registeredAt: null,
    checkedInAt: null,
  },
  {
    id: "agm-8",
    fullName: "Kwaku Frimpong",
    shareholderNumber: "SH-01562",
    branch: "Bawjiase",
    shareholding: 2550,
    phone: "024 880 5512",
    ghanaCardId: "GHA-611444-3",
    registrationType: "Not Registered",
    verificationCode: "",
    registeredBy: "",
    registeredAt: null,
    checkedInAt: null,
  },
];

export function agmAttendanceRate(): number {
  return AGM_SUMMARY.totalShareholders > 0
    ? (AGM_SUMMARY.checkedIn / AGM_SUMMARY.totalShareholders) * 100
    : 0;
}

export function agmRegistrationRate(): number {
  return AGM_SUMMARY.totalShareholders > 0
    ? (AGM_SUMMARY.registered / AGM_SUMMARY.totalShareholders) * 100
    : 0;
}

export function agmQuorumReached(): boolean {
  return agmAttendanceRate() >= AGM_SUMMARY.quorumRequiredPct;
}

export function agmRegisteredShareholders(): AgmShareholderRecord[] {
  return AGM_SHAREHOLDERS.filter(
    (record) => record.registrationType !== "Not Registered",
  );
}

export function agmPendingShareholders(): AgmShareholderRecord[] {
  return AGM_SHAREHOLDERS.filter(
    (record) => record.registrationType === "Not Registered",
  );
}

export function agmCheckedInShareholders(): AgmShareholderRecord[] {
  return AGM_SHAREHOLDERS.filter((record) => Boolean(record.checkedInAt));
}
