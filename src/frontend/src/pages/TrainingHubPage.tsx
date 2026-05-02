import { AppShell } from "@/components/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { LiveSyncBadge } from "@/components/LiveSyncBadge";
import { PortalCard } from "@/components/PortalCard";
import { RoleGuard } from "@/components/RoleGuard";
import { RetryPanel } from "@/components/RetryPanel";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  apiArchiveTrainingDocument,
  apiArchiveTrainingVideo,
  apiGetCachedTrainingDocuments,
  apiGetCachedTrainingVideos,
  apiDeleteTrainingDocument,
  apiDeleteTrainingVideo,
  apiGetMyDocumentOpenState,
  apiGetMyVideoProgress,
  apiGetTrainingDocuments,
  apiGetTrainingVideos,
  formatAudienceSummary,
  userCanManageScopedItem,
  userHasPermission,
} from "@/lib/backend-client";
import { useAuth } from "@/store/auth";
import type { TrainingDocument, TrainingVideo } from "@/types";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  Archive,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FileType,
  GraduationCap,
  LayoutGrid,
  PlayCircle,
  Search,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function formatDate(ts: bigint): string {
  return new Date(Number(ts)).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function DocIcon({ fileType }: { fileType: string }) {
  const type = String(fileType ?? "").toLowerCase();
  if (type.includes("pdf")) {
    return <FileText className="h-7 w-7 text-destructive/80" />;
  }
  if (type.includes("sheet") || type.includes("xls")) {
    return <FileSpreadsheet className="h-7 w-7 text-secondary" />;
  }
  if (type.includes("presentation") || type.includes("ppt")) {
    return <FileType className="h-7 w-7 text-accent" />;
  }
  return <BookOpen className="h-7 w-7 text-primary" />;
}

function visibilityLabel(
  value?: "General" | "Department",
  department?: string | null,
) {
  if (value === "Department") return department || "Department";
  return "General";
}

export default function TrainingHubPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const canManageVideoModule = userHasPermission(user, "trainingVideos");
  const canManageDocumentModule = userHasPermission(user, "trainingDocuments");
  const canOpenTrainingAdmin = canManageVideoModule || canManageDocumentModule;
  const [tab, setTab] = useState(() =>
    location.pathname.includes("/handbook") ? "documents" : "videos",
  );
  const [videos, setVideos] = useState<TrainingVideo[]>(() => apiGetCachedTrainingVideos());
  const [documents, setDocuments] = useState<TrainingDocument[]>(() =>
    apiGetCachedTrainingDocuments(),
  );
  const [videoProgress, setVideoProgress] = useState<Record<number, number>>(
    {},
  );
  const [documentOpened, setDocumentOpened] = useState<Record<number, boolean>>(
    {},
  );
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [videosError, setVideosError] = useState(false);
  const [documentsError, setDocumentsError] = useState(false);
  const [query, setQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [mandatoryFilter, setMandatoryFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const [archiveVideoTarget, setArchiveVideoTarget] =
    useState<TrainingVideo | null>(null);
  const [deleteVideoTarget, setDeleteVideoTarget] =
    useState<TrainingVideo | null>(null);
  const [archiveDocTarget, setArchiveDocTarget] =
    useState<TrainingDocument | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] =
    useState<TrainingDocument | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTab(location.pathname.includes("/handbook") ? "documents" : "videos");

    async function loadVideos() {
      try {
        const items = await apiGetTrainingVideos();
        if (cancelled) return;
        setVideos(items);
        setVideosError(false);
        const progressEntries = await Promise.all(
          items.map(async (video) => {
            try {
              const progress = await apiGetMyVideoProgress(video.id);
              return [video.id, progress?.progressPercent ?? 0] as const;
            } catch {
              return [video.id, 0] as const;
            }
          }),
        );
        if (cancelled) return;
        setVideoProgress(Object.fromEntries(progressEntries));
      } catch {
        if (cancelled) return;
        if (apiGetCachedTrainingVideos().length === 0) {
          setVideos([]);
        }
        setVideoProgress({});
        setVideosError(true);
        toast.error("Training videos could not be loaded. Please try again.");
      } finally {
        if (!cancelled) setLoadingVideos(false);
      }
    }

    async function loadDocuments() {
      try {
        const items = await apiGetTrainingDocuments();
        if (cancelled) return;
        setDocuments(items);
        setDocumentsError(false);
        const openedEntries = await Promise.all(
          items.map(async (doc) => {
            try {
              const state = await apiGetMyDocumentOpenState(doc.id);
              return [doc.id, state.isOpened] as const;
            } catch {
              return [doc.id, false] as const;
            }
          }),
        );
        if (cancelled) return;
        setDocumentOpened(Object.fromEntries(openedEntries));
      } catch {
        if (cancelled) return;
        if (apiGetCachedTrainingDocuments().length === 0) {
          setDocuments([]);
        }
        setDocumentOpened({});
        setDocumentsError(true);
        toast.error(
          "Training documents could not be loaded. Please try again.",
        );
      } finally {
        if (!cancelled) setLoadingDocuments(false);
      }
    }

    void loadVideos();
    void loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [user?.id, location.pathname]);

  async function retryVideos() {
    setLoadingVideos(true);
    try {
      const items = await apiGetTrainingVideos();
      setVideos(items);
      setVideosError(false);
    } catch {
      setVideosError(true);
      toast.error("Training videos could not be loaded. Please try again.");
    } finally {
      setLoadingVideos(false);
    }
  }

  async function retryDocuments() {
    setLoadingDocuments(true);
    try {
      const items = await apiGetTrainingDocuments();
      setDocuments(items);
      setDocumentsError(false);
    } catch {
      setDocumentsError(true);
      toast.error("Training documents could not be loaded. Please try again.");
    } finally {
      setLoadingDocuments(false);
    }
  }

  const departments = useMemo(() => {
    const values = new Set<string>();
    for (const video of videos) {
      if (video.department) values.add(video.department);
    }
    for (const doc of documents) {
      if (doc.department) values.add(doc.department);
    }
    return [...values].sort();
  }, [videos, documents]);

    function matchesCommonFilters(item: {
      title: string;
      description: string;
      visibility?: "General" | "Department";
      department?: string | null;
      isMandatory?: boolean;
      category: string;
    }) {
      const term = query.trim().toLowerCase();
      const title = String(item.title ?? "");
      const description = String(item.description ?? "");
      const category = String(item.category ?? "");
      const department = String(item.department ?? "");
      const matchesQuery =
        !term ||
        title.toLowerCase().includes(term) ||
        description.toLowerCase().includes(term) ||
        category.toLowerCase().includes(term) ||
        department.toLowerCase().includes(term);
      const matchesVisibility =
        visibilityFilter === "all" ||
        item.visibility?.toLowerCase() === visibilityFilter;
    const matchesMandatory =
      mandatoryFilter === "all" ||
      (mandatoryFilter === "mandatory"
        ? !!item.isMandatory
        : !item.isMandatory);
      const matchesDepartment =
        departmentFilter === "all" ||
        department.toUpperCase() === departmentFilter;
      return (
        matchesQuery && matchesVisibility && matchesMandatory && matchesDepartment
      );
    }

  const filteredVideos = videos.filter(matchesCommonFilters);
  const filteredDocuments = documents.filter(matchesCommonFilters);

  async function handleArchiveVideo() {
    if (!archiveVideoTarget) return;
    await apiArchiveTrainingVideo(archiveVideoTarget.id);
    setVideos((prev) =>
      prev.filter((item) => item.id !== archiveVideoTarget.id),
    );
    toast.success(`"${archiveVideoTarget.title}" archived`);
    setArchiveVideoTarget(null);
  }

  async function handleDeleteVideo() {
    if (!deleteVideoTarget) return;
    await apiDeleteTrainingVideo(deleteVideoTarget.id);
    setVideos((prev) =>
      prev.filter((item) => item.id !== deleteVideoTarget.id),
    );
    toast.success(`"${deleteVideoTarget.title}" deleted`);
    setDeleteVideoTarget(null);
  }

  async function handleArchiveDocument() {
    if (!archiveDocTarget) return;
    await apiArchiveTrainingDocument(archiveDocTarget.id);
    setDocuments((prev) =>
      prev.filter((item) => item.id !== archiveDocTarget.id),
    );
    toast.success(`"${archiveDocTarget.title}" archived`);
    setArchiveDocTarget(null);
  }

  async function handleDeleteDocument() {
    if (!deleteDocTarget) return;
    await apiDeleteTrainingDocument(deleteDocTarget.id);
    setDocuments((prev) =>
      prev.filter((item) => item.id !== deleteDocTarget.id),
    );
    toast.success(`"${deleteDocTarget.title}" deleted`);
    setDeleteDocTarget(null);
  }

  return (
    <AppShell>
      <div className="page-shell">
        <section className="page-header">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="page-kicker">Learning and handbook</div>
              <h1 className="page-title">Training Portal</h1>
              <p className="page-subtitle">
                Access role-relevant videos and documents, then keep progress visible for every staff member.
              </p>
            </div>
            <div className="page-actions">
              <LiveSyncBadge eventNames={[]} />
            </div>
          </div>
        </section>
        <PortalCard
          className="overflow-hidden"
          action={
            <RoleGuard roles={["SuperAdmin", "HRAdmin", "Supervisor"]} fallback={null}>
              <div className="flex flex-wrap gap-2">
                {canOpenTrainingAdmin ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => navigate({ to: "/training/admin" })}
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Dashboard
                  </Button>
                ) : null}
                {tab === "videos" && canManageVideoModule ? (
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => navigate({ to: "/training/upload-video" })}
                  >
                    <Upload className="h-4 w-4" />
                    Upload Video
                  </Button>
                ) : tab === "documents" && canManageDocumentModule ? (
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    onClick={() =>
                      navigate({ to: "/training/upload-document" })
                    }
                  >
                    <Upload className="h-4 w-4" />
                    Upload Document
                  </Button>
                ) : null}
              </div>
            </RoleGuard>
          }
        >
          <div className="grid gap-5 lg:grid-cols-[1.35fr_.95fr]">
            <div className="space-y-3">
              <div className="section-title">
                <GraduationCap className="h-6 w-6 text-primary" />
                <h1 className="font-display text-2xl font-bold text-foreground">
                  Training and Documents Portal
                </h1>
              </div>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                Access training videos, policy documents, and mandatory internal
                materials shaped around the workflow from the original staff
                portal.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  {videos.length} active videos
                </Badge>
                <Badge className="bg-secondary/10 text-secondary border-secondary/20">
                  {documents.length} active documents
                </Badge>
                {user?.department && (
                  <Badge variant="outline">{user.department}</Badge>
                )}
              </div>
            </div>

            <PortalCard className="p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="surface-muted p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Training progress
                  </div>
                  <div className="mt-2 text-2xl font-display font-bold text-foreground">
                    {
                      Object.values(videoProgress).filter(
                        (value) => value >= 98,
                      ).length
                    }
                  </div>
                  <div className="text-xs text-muted-foreground">
                    completed videos in your feed
                  </div>
                </div>
                <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Documents opened
                  </div>
                  <div className="mt-2 text-2xl font-display font-bold text-foreground">
                    {Object.values(documentOpened).filter(Boolean).length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    documents reviewed by this account
                  </div>
                </div>
              </div>
            </PortalCard>
          </div>
        </PortalCard>

        <PortalCard>
          <div className="grid gap-3 lg:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by title, description, category, or department"
                className="pl-9"
              />
            </div>
            <Select
              value={visibilityFilter}
              onValueChange={setVisibilityFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All visibility</SelectItem>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="department">Department</SelectItem>
              </SelectContent>
            </Select>
            <Select value={mandatoryFilter} onValueChange={setMandatoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Mandatory" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All items</SelectItem>
                <SelectItem value="mandatory">Mandatory only</SelectItem>
                <SelectItem value="optional">Optional only</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={departmentFilter}
              onValueChange={setDepartmentFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department} value={department}>
                    {department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </PortalCard>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="videos">
              <Video className="mr-1.5 h-4 w-4" />
              Training Videos
            </TabsTrigger>
            <TabsTrigger value="documents">
              <BookOpen className="mr-1.5 h-4 w-4" />
              Documents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="videos" className="space-y-4">
            {videosError ? (
              <RetryPanel
                title="Video feed needs a retry"
                description="Training videos could not refresh just now. Retry this section without leaving the page."
                onRetry={() => void retryVideos()}
                icon={<Video className="h-4 w-4 text-primary" />}
                compact
              />
            ) : null}
            {loadingVideos ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[
                  "video-skeleton-1",
                  "video-skeleton-2",
                  "video-skeleton-3",
                  "video-skeleton-4",
                  "video-skeleton-5",
                  "video-skeleton-6",
                ].map((key) => (
                  <SkeletonCard key={key} hasImage lines={4} />
                ))}
              </div>
            ) : filteredVideos.length === 0 ? (
              <EmptyState
                icon={<Video className="h-7 w-7" />}
                title="No training videos match these filters"
                description="Try another search or loosen the visibility and department filters."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredVideos.map((video) => {
                  const progress = videoProgress[video.id] ?? 0;
                  const watched = progress > 0;
                  const completed = progress >= 98;
                  const supportsTracking = video.storageType === "Local";
                  return (
                    <PortalCard key={video.id} className="p-0 overflow-hidden">
                      <button
                        type="button"
                        className="flex aspect-video w-full items-center justify-center bg-primary/10"
                        onClick={() =>
                          navigate({ to: `/training/video/${video.id}` })
                        }
                      >
                        <PlayCircle className="h-14 w-14 text-primary/60" />
                      </button>
                      <div className="space-y-4 p-5">
                        <div className="flex flex-wrap items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-display text-lg font-semibold text-foreground">
                              {video.title}
                            </h3>
                            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                              {video.description}
                            </p>
                          </div>
                          <Badge
                            className={
                              completed
                                ? "bg-secondary/10 text-secondary border-secondary/20"
                                : watched
                                  ? "bg-amber-500/10 text-amber-600 border-amber-400/20"
                                  : "bg-primary/10 text-primary border-primary/20"
                            }
                          >
                            {completed
                              ? supportsTracking
                                ? "Watched"
                                : "Acknowledged"
                              : watched
                                ? supportsTracking
                                  ? "In progress"
                                  : "Acknowledged"
                                : supportsTracking
                                  ? "Not watched"
                                  : "Pending acknowledgement"}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {visibilityLabel(
                              video.visibility,
                              video.department,
                            )}
                          </Badge>
                          {video.isMandatory && (
                            <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                              Mandatory
                            </Badge>
                          )}
                          <Badge className="bg-primary/10 text-primary border-primary/20">
                            {video.category}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatAudienceSummary(video.branchScope, video.departmentScope)}
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatDate(video.uploadedAt)}
                          </div>
                          <span>
                            {supportsTracking
                              ? `${Math.round(progress)}% complete`
                              : completed
                                ? "Acknowledged"
                                : "Awaiting acknowledgement"}
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            type="button"
                            className="flex-1 gap-1.5"
                            onClick={() =>
                              navigate({ to: `/training/video/${video.id}` })
                            }
                          >
                            <PlayCircle className="h-4 w-4" />
                            Watch Video
                          </Button>
                          {userCanManageScopedItem(user, video, "trainingVideos") && (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => setArchiveVideoTarget(video)}
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="border-destructive/30 text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteVideoTarget(video)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </PortalCard>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            {documentsError ? (
              <RetryPanel
                title="Document feed needs a retry"
                description="Training documents could not refresh just now. Retry this section without leaving the page."
                onRetry={() => void retryDocuments()}
                icon={<BookOpen className="h-4 w-4 text-primary" />}
                compact
              />
            ) : null}
            {loadingDocuments ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                {[
                  "doc-skeleton-1",
                  "doc-skeleton-2",
                  "doc-skeleton-3",
                  "doc-skeleton-4",
                ].map((key) => (
                  <SkeletonCard key={key} lines={4} />
                ))}
              </div>
            ) : filteredDocuments.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="h-7 w-7" />}
                title="No documents match these filters"
                description="Try another search or visibility filter."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredDocuments.map((doc) => {
                  const opened = documentOpened[doc.id] ?? false;
                  return (
                    <PortalCard key={doc.id}>
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                            <DocIcon fileType={doc.fileType} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start gap-2">
                              <h3 className="font-display text-lg font-semibold text-foreground">
                                {doc.title}
                              </h3>
                              <Badge
                                className={
                                  opened
                                    ? "bg-secondary/10 text-secondary border-secondary/20"
                                    : "bg-primary/10 text-primary border-primary/20"
                                }
                              >
                                {opened ? "Opened" : "Not opened"}
                              </Badge>
                            </div>
                            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                              {doc.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {visibilityLabel(doc.visibility, doc.department)}
                          </Badge>
                          {doc.isMandatory && (
                            <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                              Mandatory
                            </Badge>
                          )}
                          <Badge className="bg-primary/10 text-primary border-primary/20">
                            {doc.category}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatAudienceSummary(doc.branchScope, doc.departmentScope)}
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div>{formatDate(doc.uploadedAt)}</div>
                          <div>{doc.downloadCount} opened</div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            type="button"
                            className="flex-1 gap-1.5"
                            onClick={() =>
                              navigate({ to: `/training/document/${doc.id}` })
                            }
                          >
                            <ExternalLink className="h-4 w-4" />
                            Open Document
                          </Button>
                          {userCanManageScopedItem(user, doc, "trainingDocuments") && (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => setArchiveDocTarget(doc)}
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="border-destructive/30 text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteDocTarget(doc)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </PortalCard>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <PortalCard className="bg-primary/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-display text-lg font-semibold text-foreground">
                Need the full completion view?
              </div>
              <div className="text-sm text-muted-foreground">
                Open the dashboard to review eligible counts, completion
                percentages, and staff still missing mandatory training.
              </div>
            </div>
            {canOpenTrainingAdmin ? (
            <RoleGuard roles={["SuperAdmin", "HRAdmin", "Supervisor"]} permission={canManageVideoModule ? "trainingVideos" : "trainingDocuments"}>
                <Button
                  type="button"
                  className="gap-1.5"
                  onClick={() => navigate({ to: "/training/admin" })}
                >
                  Open Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
            </RoleGuard>
            ) : null}
          </div>
        </PortalCard>
      </div>

      <ConfirmDialog
        open={!!archiveVideoTarget}
        onOpenChange={(open) => !open && setArchiveVideoTarget(null)}
        title="Archive video"
        description={`Archive "${archiveVideoTarget?.title}" from the training portal?`}
        confirmLabel="Archive"
        onConfirm={handleArchiveVideo}
      />
      <ConfirmDialog
        open={!!deleteVideoTarget}
        onOpenChange={(open) => !open && setDeleteVideoTarget(null)}
        title="Delete video"
        description={`Delete "${deleteVideoTarget?.title}" permanently?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteVideo}
      />
      <ConfirmDialog
        open={!!archiveDocTarget}
        onOpenChange={(open) => !open && setArchiveDocTarget(null)}
        title="Archive document"
        description={`Archive "${archiveDocTarget?.title}" from the documents portal?`}
        confirmLabel="Archive"
        onConfirm={handleArchiveDocument}
      />
      <ConfirmDialog
        open={!!deleteDocTarget}
        onOpenChange={(open) => !open && setDeleteDocTarget(null)}
        title="Delete document"
        description={`Delete "${deleteDocTarget?.title}" permanently?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteDocument}
      />
    </AppShell>
  );
}
