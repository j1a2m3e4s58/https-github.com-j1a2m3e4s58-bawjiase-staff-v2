import { AppShell } from "@/components/AppShell";
import { RoleGuard } from "@/components/RoleGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  apiCreateAnnouncement,
  apiUploadAnnouncementAssetFile,
  canManageAllDepartmentsForBranch,
  formatAudienceSummary,
  formatManageableScopeSummary,
  getManageableBranches,
  getManageableDepartmentsForBranch,
  getScopeCoverageWarning,
} from "@/lib/backend-client";
import { optimizeImageFile } from "@/lib/image-upload";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import { DEPARTMENTS } from "@/types";
import { Link } from "@tanstack/react-router";
import {
  Camera,
  FileUp,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  Newspaper,
  Plus,
  ShieldCheck,
  Trash2,
  Vote,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_NEWS_ASSET_MB = 25;

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function NewsPortalForm() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [activeTab, setActiveTab] = useState("attach");
  const [allowDownload, setAllowDownload] = useState(true);
  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [publishing, setPublishing] = useState(false);
  const [branchTarget, setBranchTarget] = useState("ALL");
  const [departmentTarget, setDepartmentTarget] = useState("ALL");
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const category = useMemo(
    () => (user?.department === "HR" ? "HR" : "IT"),
    [user?.department],
  );
  const manageableBranches = useMemo(() => getManageableBranches(user), [user]);
  const canTargetAllBranches =
    user?.role === "SuperAdmin" || user?.role === "HRAdmin";
  const manageableDepartments = useMemo(
    () =>
      branchTarget === "ALL"
        ? [...DEPARTMENTS]
        : getManageableDepartmentsForBranch(user, branchTarget),
    [branchTarget, user],
  );
  const canTargetAllDepartments =
    user?.role === "SuperAdmin" ||
    user?.role === "HRAdmin" ||
    manageableDepartments.length === DEPARTMENTS.length;

  useEffect(() => {
    if (!canTargetAllBranches && branchTarget === "ALL" && manageableBranches.length > 0) {
      setBranchTarget(manageableBranches[0]);
    }
  }, [branchTarget, canTargetAllBranches, manageableBranches]);

  useEffect(() => {
    if (
      departmentTarget === "ALL" &&
      branchTarget !== "ALL" &&
      !canManageAllDepartmentsForBranch(user, branchTarget) &&
      manageableDepartments.length > 0
    ) {
      setDepartmentTarget(manageableDepartments[0]);
    }
  }, [branchTarget, departmentTarget, manageableDepartments, user]);

  const audienceSummary = formatAudienceSummary(
    branchTarget === "ALL" ? ["ALL"] : [branchTarget],
    departmentTarget === "ALL" ? ["ALL"] : [departmentTarget],
  );
  const actingScope = formatManageableScopeSummary(user);
  const scopeWarning = getScopeCoverageWarning(
    user,
    branchTarget,
    departmentTarget,
  );

  const stopCamera = useCallback(() => {
    const tracks = streamRef.current?.getTracks() ?? [];
    for (const track of tracks) {
      track.stop();
    }
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  async function handleFileChange(file: File | null) {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    if (!file) {
      setFileName("");
      setSelectedFile(null);
      setImagePreviewUrl(null);
      return;
    }

    if (file.size > MAX_NEWS_ASSET_MB * 1024 * 1024) {
      toast.error(
        `Attachment is too large. Please keep it under ${MAX_NEWS_ASSET_MB} MB.`,
      );
      setFileName("");
      setSelectedFile(null);
      setImagePreviewUrl(null);
      return;
    }

    let normalizedFile = file;
    if (file.type.startsWith("image/")) {
      try {
        normalizedFile = await optimizeImageFile(file, {
          maxDimension: 1600,
          quality: 0.84,
        });
      } catch {
        normalizedFile = file;
      }
    }

    setFileName(normalizedFile.name);
    setSelectedFile(normalizedFile);
    setImagePreviewUrl(
      normalizedFile.type.startsWith("image/")
        ? URL.createObjectURL(normalizedFile)
        : null,
    );
    setCapturedImage(null);
  }

  async function startCamera() {
    try {
      setCameraError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch {
      setCameraError("Camera access was blocked on this device.");
      toast.error("Camera access was blocked");
    }
  }

  async function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/png");
    setCapturedImage(dataUrl);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((value) => resolve(value), "image/png", 0.92),
    );
    if (!blob) {
      toast.error("Captured image could not be prepared");
      return;
    }
    const file = new File([blob], "camera_capture.png", {
      type: "image/png",
    });
    setSelectedFile(file);
    setFileName(file.name);
    stopCamera();
  }

  function resetForm() {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setTitle("");
    setContent("");
    setActiveTab("attach");
    setAllowDownload(true);
    setFileName("");
    setSelectedFile(null);
    setImagePreviewUrl(null);
    setPollQuestion("");
    setPollOptions(["", ""]);
    setCapturedImage(null);
    setCameraError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim() || !content.trim()) {
      toast.error("Subject and message are required");
      return;
    }

    setPublishing(true);
    try {
      let uploadedRef: string | null = null;
      if (selectedFile) {
        const uploaded = await apiUploadAnnouncementAssetFile(selectedFile);
        uploadedRef = `LOCAL:${uploaded.filename}`;
      }

      const result = await apiCreateAnnouncement(
        {
          title,
          content,
          category,
          imageUrl:
            selectedFile && selectedFile.type.startsWith("image/")
              ? uploadedRef
              : null,
          fileUrl: uploadedRef,
          attachmentName: fileName || null,
          allowDownload,
          pollQuestion,
          pollOptions,
          branchScope: branchTarget === "ALL" ? ["ALL"] : [branchTarget],
          departmentScope:
            departmentTarget === "ALL" ? ["ALL"] : [departmentTarget],
          visibility: departmentTarget === "ALL" ? "General" : "Department",
          department: departmentTarget === "ALL" ? null : departmentTarget,
        },
        {
          id: user.id,
          fullname: user.fullname,
          department: user.department,
        },
      );
      if ("err" in result) {
        toast.error(result.err);
        return;
      }

      toast.success("News posted successfully");
      resetForm();
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      {publishing && (
        <div className="fixed inset-0 z-50 bg-background/75 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="glass-card-elevated rounded-2xl border border-border/50 px-6 py-5 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="font-display font-bold text-foreground">
                Posting News
              </p>
              <p className="text-sm text-muted-foreground">
                Publishing the update to the staff portal.
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {actingScope ? (
          <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
            {actingScope}
          </div>
        ) : null}
        <div className="rounded-2xl border border-border/40 bg-card/70 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center text-primary">
                <Megaphone className="h-6 w-6" />
              </div>
              <div>
                <p className="font-display text-lg font-bold text-foreground">
                  {user?.fullname}
                </p>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <Badge variant="outline">{user?.department}</Badge>
                  <Badge variant="secondary">Admin Portal</Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button asChild variant="outline" size="sm">
                <Link to="/announcements">
                  <Newspaper className="mr-2 h-4 w-4" />
                  News Feed
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/announcements/trash">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Recycle Bin
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="news-title">Subject</Label>
              <Input
                id="news-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Subject..."
                className="h-14 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="news-content">Update</Label>
              <Textarea
                id="news-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's happening?"
                className="min-h-[150px] rounded-xl resize-none"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Branch Audience</Label>
                <Select value={branchTarget} onValueChange={setBranchTarget}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {canTargetAllBranches ? (
                      <SelectItem value="ALL">All branches</SelectItem>
                    ) : null}
                    {manageableBranches.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        {branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department Audience</Label>
                <Select
                  value={departmentTarget}
                  onValueChange={setDepartmentTarget}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {canTargetAllDepartments ? (
                      <SelectItem value="ALL">All departments</SelectItem>
                    ) : null}
                    {manageableDepartments.map((department) => (
                      <SelectItem key={department} value={department}>
                        {department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-xl border border-border/30 bg-background/40 px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                {audienceSummary}
              </p>
              {scopeWarning ? (
                <p className="mt-1 text-xs text-amber-500">{scopeWarning}</p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  This update will only appear for the branch and department audience shown above.
                </p>
              )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-auto w-full justify-start bg-transparent p-0 gap-3 flex-wrap">
                <TabsTrigger
                  value="attach"
                  className="h-12 rounded-full border border-border/40 bg-card px-5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <FileUp className="h-4 w-4" />
                  Attach
                </TabsTrigger>
                <TabsTrigger
                  value="camera"
                  className="h-12 rounded-full border border-border/40 bg-card px-5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Camera className="h-4 w-4" />
                  Camera
                </TabsTrigger>
                <TabsTrigger
                  value="poll"
                  className="h-12 rounded-full border border-border/40 bg-card px-5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Vote className="h-4 w-4" />
                  Poll
                </TabsTrigger>
              </TabsList>

              <TabsContent value="attach" className="mt-4">
                <div className="rounded-2xl border border-border/40 bg-card/60 p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="news-file">
                      Select File (Image/PDF/Word)
                    </Label>
                    <Input
                      id="news-file"
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      className="rounded-xl"
                      onChange={(e) =>
                        handleFileChange(e.target.files?.[0] ?? null)
                      }
                    />
                  </div>

                  {fileName && (
                    <div className="rounded-xl border border-border/40 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                      Attached:{" "}
                      <span className="font-semibold text-foreground">
                        {fileName}
                      </span>
                      {selectedFile ? (
                        <span className="ml-2 text-xs">
                          ({formatFileSize(selectedFile.size)})
                        </span>
                      ) : null}
                    </div>
                  )}

                  <div className="flex items-start gap-3 rounded-xl border border-border/30 bg-background/40 px-4 py-3">
                    <Switch
                      checked={allowDownload}
                      onCheckedChange={setAllowDownload}
                    />
                    <div>
                      <p className="font-semibold text-foreground">
                        Allow staff to download file
                      </p>
                      <p className="text-sm text-muted-foreground">
                        If turned off, the attachment stays view-only.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="camera" className="mt-4">
                <div className="rounded-2xl border border-border/40 bg-card/60 p-4 space-y-4">
                  {!cameraReady && !capturedImage && (
                    <Button type="button" onClick={startCamera}>
                      <Camera className="mr-2 h-4 w-4" />
                      Open Camera
                    </Button>
                  )}

                  {cameraError && (
                    <p className="text-sm text-destructive">{cameraError}</p>
                  )}

                  {cameraReady && (
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-2xl border border-border/40 bg-background/70">
                        <video
                          ref={videoRef}
                          className="aspect-video w-full object-cover"
                          muted
                          playsInline
                        />
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        <Button type="button" onClick={capturePhoto}>
                          <ImageIcon className="mr-2 h-4 w-4" />
                          Capture
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={stopCamera}
                        >
                          Stop Camera
                        </Button>
                      </div>
                    </div>
                  )}

                  {capturedImage && (
                    <div className="space-y-3">
                      <div className="overflow-hidden rounded-2xl border border-border/40 bg-background/70">
                        <img
                          src={capturedImage}
                          alt="Captured preview"
                          className="aspect-video w-full object-cover"
                        />
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCapturedImage(null)}
                        >
                          Retake
                        </Button>
                        <p className="text-sm text-muted-foreground self-center">
                          Captured image will be posted as the attachment.
                        </p>
                      </div>
                    </div>
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              </TabsContent>

              <TabsContent value="poll" className="mt-4">
                <div className="rounded-2xl border border-border/40 bg-card/60 p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="poll-question">Poll Question</Label>
                    <Input
                      id="poll-question"
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder="Ask staff a question..."
                    />
                  </div>

                  <div className="space-y-3">
                    {pollOptions.map((option, index) => (
                      <div
                        key={`poll-option-${index + 1}`}
                        className="flex gap-3"
                      >
                        <Input
                          value={option}
                          onChange={(e) =>
                            setPollOptions((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? e.target.value : item,
                              ),
                            )
                          }
                          placeholder={`Option ${index + 1}`}
                        />
                        {pollOptions.length > 2 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              setPollOptions((current) =>
                                current.filter(
                                  (_, itemIndex) => itemIndex !== index,
                                ),
                              )
                            }
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setPollOptions((current) => [...current, ""])
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Option
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {category} post permissions confirmed.
              </div>
              <Button
                type="submit"
                size="lg"
                className="min-w-[180px] rounded-full"
              >
                <Megaphone className="mr-2 h-4 w-4" />
                Post Now
              </Button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}

export default function NewsPortalPage() {
  return (
    <AppShell>
      <div className="max-w-[980px] mx-auto space-y-6">
        <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                Post News
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Publish staff updates, attach files, capture a photo, or add a
                poll without changing the rest of the portal layout.
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn("rounded-full px-3 py-1 text-xs")}
            >
              News Portal
            </Badge>
          </div>
        </div>

        <RoleGuard
          roles={["SuperAdmin", "HRAdmin", "Supervisor"]}
          permission="announcements"
          fallback={
            <div className="rounded-2xl border border-border/40 bg-card/60 p-8 text-center">
              <Megaphone className="mx-auto h-10 w-10 text-primary" />
              <h2 className="mt-4 font-display text-xl font-bold text-foreground">
                Admin access only
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Posting news is limited to IT, HR, and portal administrators.
              </p>
            </div>
          }
        >
          <NewsPortalForm />
        </RoleGuard>
      </div>
    </AppShell>
  );
}
