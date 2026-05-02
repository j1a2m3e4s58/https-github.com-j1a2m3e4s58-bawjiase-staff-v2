import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { PortalCard } from "@/components/PortalCard";
import { RoleGuard } from "@/components/RoleGuard";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  apiGetAdminTrainingOverview,
  apiSendVideoTrainingReminder,
  formatAudienceSummary,
  userHasPermission,
} from "@/lib/backend-client";
import { useAuth } from "@/store/auth";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bell,
  BookOpen,
  FileText,
  GraduationCap,
  LayoutGrid,
  TrendingUp,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface VideoStat {
  id: number;
  title: string;
  eligibleCount: number;
  watchedCount: number;
  completionPct: number;
  isMandatory: boolean;
  incompleteCount: number;
  incompleteUsers: string[];
  branchScope?: string[];
  departmentScope?: string[];
}

interface DocStat {
  id: number;
  title: string;
  eligibleCount: number;
  openedCount: number;
  openedPct: number;
  isMandatory: boolean;
  incompleteCount: number;
  incompleteUsers: string[];
  branchScope?: string[];
  departmentScope?: string[];
}

interface AdminOverview {
  totalVideos: number;
  totalDocuments: number;
  totalStaff: number;
  videoStats: VideoStat[];
  docStats: DocStat[];
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <PortalCard className="h-full">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <div className="font-display text-2xl font-bold text-foreground">
            {value}
          </div>
          <div className="text-sm font-medium text-foreground">{label}</div>
          <div className="text-xs text-muted-foreground">{sub}</div>
        </div>
      </div>
    </PortalCard>
  );
}

export default function TrainingAdminPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageVideoModule = userHasPermission(user, "trainingVideos");
  const canManageDocumentModule = userHasPermission(user, "trainingDocuments");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingReminder, setSendingReminder] = useState<number | null>(null);
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");

  useEffect(() => {
    let cancelled = false;
    async function loadOverview() {
      try {
        const data = (await apiGetAdminTrainingOverview()) as AdminOverview;
        if (!cancelled) setOverview(data);
      } catch {
        if (!cancelled) {
          setOverview(null);
          toast.error("Training dashboard could not be loaded. Please try again.");
        }
      }
    }

    loadOverview().finally(() => {
      if (!cancelled) setLoading(false);
    });

    const onFocus = () => {
      void loadOverview();
    };
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadOverview();
      }
    }, 10000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadOverview();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const overallVideoCompletion = useMemo(() => {
    if (!overview?.videoStats.length) return 0;
    return Math.round(
      overview.videoStats.reduce((sum, item) => sum + item.completionPct, 0) /
        overview.videoStats.length,
    );
  }, [overview]);

  const overallDocCompletion = useMemo(() => {
    if (!overview?.docStats.length) return 0;
    return Math.round(
      overview.docStats.reduce((sum, item) => sum + item.openedPct, 0) /
        overview.docStats.length,
    );
  }, [overview]);

  const availableBranches = useMemo(() => {
    if (!overview) return [];
    const set = new Set<string>();
    [...overview.videoStats, ...overview.docStats].forEach((item) => {
      (item.branchScope ?? ["ALL"]).forEach((branch) => {
        if (branch !== "ALL") set.add(branch);
      });
    });
    return Array.from(set).sort();
  }, [overview]);

  const availableDepartments = useMemo(() => {
    if (!overview) return [];
    const set = new Set<string>();
    [...overview.videoStats, ...overview.docStats]
      .filter((item) => {
        if (branchFilter === "ALL") return true;
        const branches = item.branchScope ?? ["ALL"];
        return branches.includes("ALL") || branches.includes(branchFilter);
      })
      .forEach((item) => {
        (item.departmentScope ?? ["ALL"]).forEach((department) => {
          if (department !== "ALL") set.add(department);
        });
      });
    return Array.from(set).sort();
  }, [branchFilter, overview]);

  useEffect(() => {
    if (
      departmentFilter !== "ALL" &&
      availableDepartments.length > 0 &&
      !availableDepartments.includes(departmentFilter)
    ) {
      setDepartmentFilter("ALL");
    }
  }, [availableDepartments, departmentFilter]);

  function matchesScope(
    branchScope: string[] | undefined,
    departmentScope: string[] | undefined,
  ) {
    const branches = branchScope ?? ["ALL"];
    const departments = departmentScope ?? ["ALL"];
    const branchMatches =
      branchFilter === "ALL" ||
      branches.includes("ALL") ||
      branches.includes(branchFilter);
    const departmentMatches =
      departmentFilter === "ALL" ||
      departments.includes("ALL") ||
      departments.includes(departmentFilter);
    return branchMatches && departmentMatches;
  }

  const filteredVideoStats = useMemo(
    () =>
      (overview?.videoStats ?? []).filter((item) =>
        matchesScope(item.branchScope, item.departmentScope),
      ),
    [branchFilter, departmentFilter, overview],
  );

  const filteredDocStats = useMemo(
    () =>
      (overview?.docStats ?? []).filter((item) =>
        matchesScope(item.branchScope, item.departmentScope),
      ),
    [branchFilter, departmentFilter, overview],
  );

  async function sendReminder(videoId: number, title: string) {
    setSendingReminder(videoId);
    try {
      await apiSendVideoTrainingReminder(videoId);
      toast.success(`Reminder sent for "${title}"`);
    } finally {
      setSendingReminder(null);
    }
  }

  return (
    <AppShell>
      <RoleGuard
        roles={["SuperAdmin", "HRAdmin", "Supervisor"]}
        permission={userHasPermission(user, "trainingVideos") ? "trainingVideos" : "trainingDocuments"}
        fallback={
          <div className="py-16 text-center text-muted-foreground">
            You do not have permission to view this page.
          </div>
        }
      >
        <div className="page-shell">
          <section className="page-header">
            <div className="page-kicker">Training analytics</div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-1 mb-4 gap-1.5"
              onClick={() => navigate({ to: "/training" })}
            >
              <ArrowLeft className="h-4 w-4" />
              Training portal
            </Button>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-primary" />
                <h1 className="font-display text-2xl font-bold text-foreground">
                  Training Dashboard
                </h1>
              </div>
              <p className="page-subtitle mt-2">
                Completion summaries for training videos and document
                acknowledgements.
              </p>
            </div>
          </div>
          </section>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                "dashboard-skeleton-1",
                "dashboard-skeleton-2",
                "dashboard-skeleton-3",
                "dashboard-skeleton-4",
              ].map((key) => (
                <SkeletonCard key={key} lines={3} />
              ))}
            </div>
          ) : !overview ? (
            <EmptyState
              icon={<LayoutGrid className="h-7 w-7" />}
              title="No dashboard data available"
              description="Upload training videos or documents to start tracking engagement."
            />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  icon={<Video className="h-5 w-5" />}
                  label="Training Videos"
                  value={overview.totalVideos}
                  sub="active items"
                />
                <StatCard
                  icon={<FileText className="h-5 w-5" />}
                  label="Documents"
                  value={overview.totalDocuments}
                  sub="active items"
                />
                <StatCard
                  icon={<GraduationCap className="h-5 w-5" />}
                  label="Eligible Staff"
                  value={overview.totalStaff}
                  sub="active staff pool"
                />
                <StatCard
                  icon={<TrendingUp className="h-5 w-5" />}
                  label="Overall Completion"
                  value={`${Math.round((overallVideoCompletion + overallDocCompletion) / 2)}%`}
                  sub="videos and documents"
                />
              </div>

              <Tabs defaultValue={canManageVideoModule ? "videos" : "documents"}>
                <div className="toolbar-surface mb-4">
                  <div className="space-y-1.5">
                    <div className="text-sm font-medium text-foreground">Branch filter</div>
                    <Select value={branchFilter} onValueChange={setBranchFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All manageable branches</SelectItem>
                        {availableBranches.map((branch) => (
                          <SelectItem key={branch} value={branch}>
                            {branch}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-sm font-medium text-foreground">Department filter</div>
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All manageable departments</SelectItem>
                        {availableDepartments.map((department) => (
                          <SelectItem key={department} value={department}>
                            {department}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <TabsList>
                  {canManageVideoModule ? (
                    <TabsTrigger value="videos">
                      <Video className="mr-1.5 h-4 w-4" />
                      Video Dashboard
                    </TabsTrigger>
                  ) : null}
                  {canManageDocumentModule ? (
                    <TabsTrigger value="documents">
                      <BookOpen className="mr-1.5 h-4 w-4" />
                      Documents Dashboard
                    </TabsTrigger>
                  ) : null}
                </TabsList>

                {canManageVideoModule ? <TabsContent value="videos" className="space-y-5">
                  <div className="grid gap-4 lg:grid-cols-4">
                    <StatCard
                      icon={<Video className="h-5 w-5" />}
                      label="Videos"
                      value={overview.totalVideos}
                      sub="current catalogue"
                    />
                    <StatCard
                      icon={<GraduationCap className="h-5 w-5" />}
                      label="Eligible Views"
                      value={overview.videoStats.reduce(
                        (sum, item) => sum + item.eligibleCount,
                        0,
                      )}
                      sub="all assigned staff"
                    />
                    <StatCard
                      icon={<Bell className="h-5 w-5" />}
                      label="Watched"
                      value={overview.videoStats.reduce(
                        (sum, item) => sum + item.watchedCount,
                        0,
                      )}
                      sub="staff starts/completions"
                    />
                    <StatCard
                      icon={<TrendingUp className="h-5 w-5" />}
                      label="Overall Completion"
                      value={`${overallVideoCompletion}%`}
                      sub="average across videos"
                    />
                  </div>

                  <PortalCard
                    title="Completion Summary"
                    subtitle="Mirrors the original training dashboard structure."
                  >
                    <div className="space-y-4">
                      {filteredVideoStats.map((video) => (
                        <div
                          key={video.id}
                          className="rounded-lg border border-border/40 bg-background/40 p-4"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-display text-lg font-semibold text-foreground">
                                  {video.title}
                                </div>
                                {video.isMandatory && (
                                  <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                                    Mandatory
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-1 text-sm text-muted-foreground">
                                {video.watchedCount} of {video.eligibleCount}{" "}
                                eligible staff completed this video.
                              </div>
                              <div className="mt-2 text-xs text-muted-foreground">
                                {formatAudienceSummary(
                                  video.branchScope,
                                  video.departmentScope,
                                )}
                              </div>
                              {video.incompleteCount > 0 ? (
                                <div className="mt-3 space-y-2">
                                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Still outstanding
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {video.incompleteUsers.map((name) => (
                                      <Badge
                                        key={`${video.id}-${name}`}
                                        variant="outline"
                                      >
                                        {name}
                                      </Badge>
                                    ))}
                                  </div>
                                  {video.incompleteCount >
                                  video.incompleteUsers.length ? (
                                    <div className="text-xs text-muted-foreground">
                                      Showing first {video.incompleteUsers.length} of{" "}
                                      {video.incompleteCount} remaining staff.
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="mt-3 text-xs text-secondary">
                                  Everyone eligible has completed this video.
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="min-w-16 text-right text-sm font-semibold text-foreground">
                                {video.completionPct}%
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                disabled={sendingReminder === video.id}
                                onClick={() =>
                                  sendReminder(video.id, video.title)
                                }
                              >
                                <Bell className="h-4 w-4" />
                                {sendingReminder === video.id
                                  ? "Sending..."
                                  : "Remind"}
                              </Button>
                            </div>
                          </div>
                          <Progress
                            value={video.completionPct}
                            className="mt-4 h-2.5"
                          />
                        </div>
                      ))}
                    </div>
                  </PortalCard>

                  <PortalCard
                    title="Mandatory Incomplete"
                    subtitle="Staff still missing mandatory video completion."
                  >
                    {overview.videoStats.every(
                      (video) =>
                        !video.isMandatory ||
                        video.incompleteUsers.length === 0,
                    ) ? (
                      <div className="text-sm text-muted-foreground">
                        All mandatory videos are currently completed.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredVideoStats
                          .filter(
                            (video) =>
                              video.isMandatory &&
                              video.incompleteUsers.length > 0,
                          )
                          .map((video) => (
                            <div
                              key={`missing-${video.id}`}
                              className="rounded-lg border border-border/40 bg-background/40 p-4"
                            >
                              <div className="font-medium text-foreground">
                                {video.title}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {video.incompleteUsers.map((name) => (
                                  <Badge
                                    key={`${video.id}-${name}`}
                                    variant="outline"
                                  >
                                    {name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </PortalCard>
                </TabsContent> : null}

                {canManageDocumentModule ? <TabsContent value="documents" className="space-y-5">
                  <div className="grid gap-4 lg:grid-cols-4">
                    <StatCard
                      icon={<FileText className="h-5 w-5" />}
                      label="Documents"
                      value={overview.totalDocuments}
                      sub="current library"
                    />
                    <StatCard
                      icon={<GraduationCap className="h-5 w-5" />}
                      label="Eligible Views"
                      value={overview.docStats.reduce(
                        (sum, item) => sum + item.eligibleCount,
                        0,
                      )}
                      sub="staff assigned to read"
                    />
                    <StatCard
                      icon={<BookOpen className="h-5 w-5" />}
                      label="Opened"
                      value={overview.docStats.reduce(
                        (sum, item) => sum + item.openedCount,
                        0,
                      )}
                      sub="acknowledged documents"
                    />
                    <StatCard
                      icon={<TrendingUp className="h-5 w-5" />}
                      label="Overall Completion"
                      value={`${overallDocCompletion}%`}
                      sub="average open rate"
                    />
                  </div>

                  <PortalCard
                    title="Document Summary"
                    subtitle="Built from the original documents dashboard flow."
                  >
                    <div className="space-y-4">
                      {filteredDocStats.map((doc) => (
                        <div
                          key={doc.id}
                          className="rounded-lg border border-border/40 bg-background/40 p-4"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-display text-lg font-semibold text-foreground">
                                  {doc.title}
                                </div>
                                {doc.isMandatory && (
                                  <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                                    Mandatory
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-1 text-sm text-muted-foreground">
                                {doc.openedCount} of {doc.eligibleCount}{" "}
                                eligible staff opened this document.
                              </div>
                              <div className="mt-2 text-xs text-muted-foreground">
                                {formatAudienceSummary(
                                  doc.branchScope,
                                  doc.departmentScope,
                                )}
                              </div>
                              {doc.incompleteCount > 0 ? (
                                <div className="mt-3 space-y-2">
                                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Still outstanding
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {doc.incompleteUsers.map((name) => (
                                      <Badge
                                        key={`${doc.id}-${name}`}
                                        variant="outline"
                                      >
                                        {name}
                                      </Badge>
                                    ))}
                                  </div>
                                  {doc.incompleteCount >
                                  doc.incompleteUsers.length ? (
                                    <div className="text-xs text-muted-foreground">
                                      Showing first {doc.incompleteUsers.length} of{" "}
                                      {doc.incompleteCount} remaining staff.
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="mt-3 text-xs text-secondary">
                                  Everyone eligible has opened this document.
                                </div>
                              )}
                            </div>
                            <div className="min-w-16 text-right text-sm font-semibold text-foreground">
                              {doc.openedPct}%
                            </div>
                          </div>
                          <Progress
                            value={doc.openedPct}
                            className="mt-4 h-2.5"
                          />
                        </div>
                      ))}
                    </div>
                  </PortalCard>

                  <PortalCard
                    title="Mandatory Incomplete"
                    subtitle="Users still missing mandatory document acknowledgements."
                  >
                    {overview.docStats.every(
                      (doc) =>
                        !doc.isMandatory || doc.incompleteUsers.length === 0,
                    ) ? (
                      <div className="text-sm text-muted-foreground">
                        All mandatory documents are currently opened by their
                        assigned staff.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredDocStats
                          .filter(
                            (doc) =>
                              doc.isMandatory && doc.incompleteUsers.length > 0,
                          )
                          .map((doc) => (
                            <div
                              key={`doc-missing-${doc.id}`}
                              className="rounded-lg border border-border/40 bg-background/40 p-4"
                            >
                              <div className="font-medium text-foreground">
                                {doc.title}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {doc.incompleteUsers.map((name) => (
                                  <Badge
                                    key={`${doc.id}-${name}`}
                                    variant="outline"
                                  >
                                    {name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </PortalCard>
                </TabsContent> : null}
              </Tabs>
            </>
          )}
        </div>
      </RoleGuard>
    </AppShell>
  );
}
