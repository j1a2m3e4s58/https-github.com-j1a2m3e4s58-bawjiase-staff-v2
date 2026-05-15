import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export class ExternalBlob {
    getBytes(): Promise<Uint8Array<ArrayBuffer>>;
    getDirectURL(): string;
    static fromURL(url: string): ExternalBlob;
    static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob;
    withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob;
}
export interface UpdateAnnouncementInput {
    id: bigint;
    title: string;
    imageFile?: ExternalBlob;
    body: string;
    allowDownload: boolean;
    category: AnnouncementCategory;
}
export type Timestamp = bigint;
export interface PollOptionResult {
    votedByMe: boolean;
    optionId: bigint;
    voteCount: bigint;
    optionText: string;
}
export interface AuditLog {
    id: bigint;
    action: string;
    actorName: string;
    target: string;
    timestamp: bigint;
    ipAddress: string;
}
export interface Form {
    id: bigint;
    title: string;
    filename: string;
    category: FormCategory;
    uploadDate: Timestamp;
}
export interface Poll {
    id: bigint;
    question: string;
    announcementId: bigint;
}
export interface PollResult {
    question: string;
    options: Array<PollOptionResult>;
    pollId: bigint;
}
export interface UpdateProfileRequest {
    imageFile?: ExternalBlob;
    fullname?: string;
    phone?: string;
}
export interface RegisterRequest {
    branch: Branch;
    accessCode?: string;
    email: string;
    fullname: string;
    passwordHash: string;
    phone: string;
    department: Department;
    position: string;
}
export interface CreatePollInput {
    question: string;
    options: Array<string>;
    announcementId: bigint;
}
export interface CreateAnnouncementInput {
    title: string;
    imageFile?: ExternalBlob;
    body: string;
    authorName: string;
    allowDownload: boolean;
    category: AnnouncementCategory;
}
export interface UpdateFormInput {
    id: bigint;
    title: string;
    filename: string;
    category: FormCategory;
}
export interface CreateFormInput {
    title: string;
    filename: string;
    category: FormCategory;
}
export interface NotificationPublic {
    id: bigint;
    title: string;
    userId: string;
    link?: string;
    createdAt: Timestamp;
    isRead: boolean;
    message: string;
}
export interface StaffStats {
    branchesWithStaff: bigint;
    activeCount: bigint;
    archivedCount: bigint;
}
export interface User {
    id: Principal;
    branch: Branch;
    imageFile?: Uint8Array;
    role: Role;
    isArchived: boolean;
    isActive: boolean;
    email: string;
    fullname: string;
    isVerified: boolean;
    phone: string;
    department: Department;
    position: string;
    registrationTime: bigint;
    lastSeen: bigint;
}
export interface AnnouncementPublic {
    id: bigint;
    title: string;
    isDeleted: boolean;
    imageFile?: ExternalBlob;
    authorId: string;
    body: string;
    authorName: string;
    allowDownload: boolean;
    datePosted: Timestamp;
    category: AnnouncementCategory;
}
export interface AnnouncementWithPoll {
    poll?: PollResult;
    announcement: AnnouncementPublic;
}
export interface CreateNotificationInput {
    title: string;
    userId: UserId;
    link?: string;
    message: string;
}
export type UserId = Principal;
export interface UpdateStaffRequest {
    branch?: Branch;
    role?: Role;
    department?: Department;
    position?: string;
}
export enum AnnouncementCategory {
    HR = "HR",
    IT = "IT",
    General = "General"
}
export enum Branch {
    Bawjiase = "Bawjiase",
    KasoaMain = "KasoaMain",
    Ofaakor = "Ofaakor",
    HeadOffice = "HeadOffice",
    Adeiso = "Adeiso",
    KasoaNewMarket = "KasoaNewMarket"
}
export enum Department {
    HR = "HR",
    IT = "IT",
    Susu = "Susu",
    Compliance = "Compliance",
    Bawjiase = "Bawjiase",
    Recovery = "Recovery",
    EBanking = "EBanking",
    KasoaMain = "KasoaMain",
    Admin = "Admin",
    Credit = "Credit",
    Ofaakor = "Ofaakor",
    Audit = "Audit",
    HeadOffice = "HeadOffice",
    Adeiso = "Adeiso",
    KasoaNewMarket = "KasoaNewMarket",
    Microfinance = "Microfinance",
    BankingOperations = "BankingOperations"
}
export enum FormCategory {
    HR = "HR",
    IT = "IT",
    General = "General",
    Operations = "Operations",
    Finance = "Finance"
}
export enum Role {
    HRAdmin = "HRAdmin",
    GeneralStaff = "GeneralStaff",
    SuperAdmin = "SuperAdmin"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    archiveStaff(userId: Principal): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    confirmPasswordReset(token: string, newPasswordHash: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    createAnnouncement(input: CreateAnnouncementInput): Promise<AnnouncementPublic>;
    createForm(input: CreateFormInput): Promise<Form>;
    createNotification(input: CreateNotificationInput): Promise<NotificationPublic>;
    createPoll(input: CreatePollInput): Promise<Poll>;
    deleteAnnouncement(id: bigint): Promise<boolean>;
    deleteAuditLog(id: bigint): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deleteAuditLogs(ids: Array<bigint>): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    deleteForm(id: bigint): Promise<boolean>;
    deleteStaff(userId: Principal): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getActiveStaff(): Promise<Array<User>>;
    getAnnouncements(): Promise<Array<AnnouncementWithPoll>>;
    getArchivedStaff(): Promise<Array<User>>;
    getAuditLogs(): Promise<Array<AuditLog>>;
    getCallerUserRole(): Promise<UserRole>;
    getForms(): Promise<Array<Form>>;
    getMyProfile(): Promise<User | null>;
    getNotifications(): Promise<Array<NotificationPublic>>;
    getPollResult(announcementId: bigint): Promise<PollResult | null>;
    getStaffMember(userId: Principal): Promise<User | null>;
    getStaffStats(): Promise<StaffStats>;
    getTrashedAnnouncements(): Promise<Array<AnnouncementPublic>>;
    getUnreadNotificationCount(): Promise<bigint>;
    hideAnnouncement(announcementId: bigint): Promise<void>;
    isCallerAdmin(): Promise<boolean>;
    logAction(actorName: string, action: string, target: string, ipAddress: string): Promise<void>;
    logAnnouncementDownload(announcementId: bigint): Promise<void>;
    login(email: string, passwordHash: string): Promise<{
        __kind__: "ok";
        ok: User;
    } | {
        __kind__: "err";
        err: string;
    }>;
    agmGetSettings(year: string): Promise<any>;
    agmUpdateSettings(year: string, token: string, settings: any): Promise<any>;
    agmGetAllShareholders(year: string): Promise<any>;
    agmGetAllShareholdersSecure(year: string, token: string): Promise<any>;
    agmSearchShareholders(year: string, query: string, statusFilter: any, page: bigint, pageSize: bigint): Promise<any>;
    agmSearchShareholdersSecure(year: string, token: string, query: string, statusFilter: any, page: bigint, pageSize: bigint): Promise<any>;
    agmGetAllRegistrations(year: string): Promise<any>;
    agmGetAllCheckIns(year: string): Promise<any>;
    agmGetDashboardMetrics(year: string, quorumThreshold: bigint): Promise<any>;
    agmCreateImportBatch(year: string, filename: string, uploadedBy: string, totalRows: bigint): Promise<any>;
    agmGetImportBatches(year: string): Promise<any>;
    agmBulkCreateShareholders(year: string, items: any[], importedBy: string): Promise<any>;
    agmUpdateImportBatchStatus(year: string, id: string, status: any, importedRows: bigint, duplicates: bigint): Promise<any>;
    agmRegisterShareholder(year: string, shareholderId: string, regType: any, proxyData: any, registeredBy: string): Promise<any>;
    agmGetRegistrationByShareholder(year: string, shareholderId: string): Promise<any>;
    agmUpdateRegistration(year: string, id: string, updates: any, updatedBy: string): Promise<any>;
    agmCancelRegistration(year: string, id: string, cancelledBy: string, reason: string): Promise<any>;
    agmUndoCheckIn(year: string, shareholderId: string, undoneBy: string): Promise<any>;
    agmUpdateShareholderContact(year: string, id: string, phone: string[] | [], idNumber: string, updatedBy: string): Promise<any>;
    agmCheckInShareholder(year: string, shareholderId: string, registrationId: string, method: any, checkedInBy: string): Promise<any>;
    agmGetAuditLog(year: string, entityType: string[] | [], entityId: string[] | [], limit: bigint): Promise<any>;
    logout(): Promise<void>;
    markAllNotificationsRead(): Promise<void>;
    markNotificationRead(id: bigint): Promise<boolean>;
    permanentDeleteAnnouncement(id: bigint): Promise<boolean>;
    register(req: RegisterRequest): Promise<{
        __kind__: "ok";
        ok: User;
    } | {
        __kind__: "err";
        err: string;
    }>;
    requestPasswordReset(email: string): Promise<{
        __kind__: "ok";
        ok: string;
    } | {
        __kind__: "err";
        err: string;
    }>;
    resendVerificationCode(email: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    restoreAnnouncement(id: bigint): Promise<boolean>;
    restoreStaff(userId: Principal): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateAnnouncement(input: UpdateAnnouncementInput): Promise<AnnouncementPublic | null>;
    updateForm(input: UpdateFormInput): Promise<Form | null>;
    updateLastSeen(): Promise<void>;
    updateMyProfile(req: UpdateProfileRequest): Promise<{
        __kind__: "ok";
        ok: User;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateStaff(userId: Principal, req: UpdateStaffRequest): Promise<{
        __kind__: "ok";
        ok: User;
    } | {
        __kind__: "err";
        err: string;
    }>;
    verifyEmail(email: string, code: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    vote(pollId: bigint, optionId: bigint): Promise<boolean>;
}
