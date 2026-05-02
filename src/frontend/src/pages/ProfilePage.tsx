import { AppShell } from "@/components/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PortalCard } from "@/components/PortalCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  type UpdateProfileRequest,
  apiGetMyProfile,
  apiUpdateMyProfile,
  apiUploadProfilePhotoFile,
  resolveStoredAssetUrl,
} from "@/lib/backend-client";
import { optimizeImageFile } from "@/lib/image-upload";
import { useAuth } from "@/store/auth";
import { BRANCHES, DEPARTMENTS } from "@/types";
import type { Role, User } from "@/types";
import { useRouter } from "@tanstack/react-router";
import {
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  ImageOff,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Save,
  Shield,
  User as UserIcon,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

function getInitials(fullname: string): string {
  return fullname
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function cleanDisplayText(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  if (!text) return "";
  return text
    .replace(/ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â/g, "")
    .replace(/Ã[^\s-]*/g, "")
    .replace(/â€”|â€“/g, "-")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizePortalTimestamp(value: bigint): number {
  const raw = Number(value);
  if (raw <= 0) return 0;
  return raw < 1_000_000_000_000 ? raw * 1000 : raw;
}

function formatLastSeen(value: bigint): string {
  const timestamp = normalizePortalTimestamp(value);
  if (timestamp <= 0) return "Never";

  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;

  const date = new Date(timestamp);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" as const }),
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRegisteredAt(value: bigint): string {
  const timestamp = normalizePortalTimestamp(value);
  if (timestamp <= 0) return "Unknown";

  return new Date(timestamp).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roleLabel(role: Role): string {
  switch (role) {
    case "SuperAdmin":
      return "Super Admin";
    case "HRAdmin":
      return "HR Admin";
    case "Supervisor":
      return "Supervisor";
    default:
      return "Staff";
  }
}

function roleBadgeVariant(role: Role): "default" | "secondary" | "outline" {
  switch (role) {
    case "SuperAdmin":
      return "default";
    case "HRAdmin":
    case "Supervisor":
      return "secondary";
    default:
      return "outline";
  }
}

function ProfileSkeleton() {
  return (
    <div className="page-shell-compact pb-8">
      <div className="glass-card-elevated h-44 panel-sharp animate-pulse" />
      <div className="glass-card h-96 panel-sharp animate-pulse" />
      <div className="glass-card h-40 panel-sharp animate-pulse" />
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border/20 py-2 last:border-b-0">
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center bg-primary/8 text-muted-foreground">
        {icon}
      </span>
      <span className="w-24 flex-shrink-0 text-xs text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground min-w-0 truncate">{value}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(!user);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [fullname, setFullname] = useState(() => user?.fullname ?? "");
  const [phone, setPhone] = useState(() => user?.phone ?? "");
  const [department, setDepartment] = useState(() => user?.department ?? "");
  const [branch, setBranch] = useState(() => user?.branch ?? "");
  const [itCode, setItCode] = useState("");
  const [itCodeError, setItCodeError] = useState("");

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);

  const isPrivileged = user?.role === "SuperAdmin" || user?.role === "HRAdmin";
  const isChangingToIT =
    !!user &&
    isPrivileged &&
    department === "IT" &&
    user.department !== "IT";

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    if (!isEditing) {
      setFullname(user.fullname);
      setPhone(user.phone);
      setDepartment(user.department);
      setBranch(user.branch);
    }
    setIsLoading(false);
  }, [isEditing, user]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const userId = user.id;

    async function loadProfile() {
      try {
        const profile = await apiGetMyProfile(userId);
        if (!mounted || !profile) return;
        updateUser(profile);
        if (!isEditing) {
          setFullname(profile.fullname);
          setPhone(profile.phone);
          setDepartment(profile.department);
          setBranch(profile.branch);
        }
      } catch {
        // keep current local state
      }
    }

    void loadProfile();
    return () => {
      mounted = false;
    };
  }, [isEditing, user?.id]);

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  function handleAvatarClick() {
    if (isEditing) {
      fileInputRef.current?.click();
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    let file = selected;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Please keep profile photos under 10 MB");
      return;
    }
    try {
      file = await optimizeImageFile(file, {
        maxDimension: 1200,
        quality: 0.82,
      });
    } catch {
      // keep original image if optimization fails
    }
    if (photoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setRemovePhoto(false);
  }

  function resetEditorState(target: User) {
    setFullname(target.fullname);
    setPhone(target.phone);
    setDepartment(target.department);
    setBranch(target.branch);
    setItCode("");
    setItCodeError("");
    if (photoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(null);
    setPhotoFile(null);
    setRemovePhoto(false);
  }

  function handleCancelEdit() {
    if (!user) return;
    resetEditorState(user);
    setIsEditing(false);
  }

  function handleRemovePhoto() {
    if (photoPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(null);
    setPhotoFile(null);
    setRemovePhoto(true);
  }

  async function handleSave() {
    if (!user) return;

    if (isChangingToIT && !itCode.trim()) {
      setItCodeError("IT access code is required");
      return;
    }

    setIsSaving(true);
    try {
      const req: UpdateProfileRequest = {
        fullname: fullname.trim(),
        phone: phone.trim(),
      };

      if (isPrivileged) {
        req.department = department;
        req.branch = branch;
      }

      if (isChangingToIT) {
        req.accessCode = itCode.trim();
      }

      if (photoFile) {
        const uploaded = await apiUploadProfilePhotoFile(photoFile);
        req.imageFile = `LOCAL:${uploaded.filename}`;
      } else if (removePhoto) {
        req.imageFile = null;
      }

      const result = await apiUpdateMyProfile(user.id, req);
      if ("ok" in result) {
        const updated = result.ok;
        updateUser(updated);
        resetEditorState(updated);
        setIsEditing(false);
        toast.success("Profile updated successfully");
      } else {
        if ((result.err ?? "").toLowerCase().includes("access code")) {
          setItCodeError(result.err ?? "Invalid IT access code");
        }
        toast.error(result.err ?? "Failed to update profile");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Profile could not be updated",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleLogout() {
    void logout().finally(() => {
      void router.navigate({ to: "/login", replace: true });
    });
  }

  if (isLoading) {
    return (
      <AppShell>
        <ProfileSkeleton />
      </AppShell>
    );
  }

  if (!user) return null;

  const displayPhoto = removePhoto
    ? null
    : photoPreview ?? resolveStoredAssetUrl(user.imageFile);
  const hasExistingProfilePhoto = !!resolveStoredAssetUrl(user.imageFile);
  const initials = getInitials(user.fullname);
  const cleanPosition = cleanDisplayText(user.position);

  return (
    <AppShell>
      <div className="page-shell-compact pb-8" data-ocid="profile.page">
        <section className="page-header">
          <div className="page-kicker">Personal workspace</div>
          <h1 className="page-title text-foreground">My Profile</h1>
          <p className="page-subtitle">
            Review your identity details, keep your contact information current, and manage your account presence.
          </p>
          <div className="page-badge-row">
            <Badge variant={roleBadgeVariant(user.role)}>
              <Shield className="mr-1 h-3 w-3" />
              {roleLabel(user.role)}
            </Badge>
            <Badge variant="outline" className="text-xs">
              <MapPin className="mr-1 h-3 w-3" />
              {user.branch}
            </Badge>
          </div>
        </section>
        <PortalCard elevated data-ocid="profile.header.card">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className="relative flex-shrink-0">
              <button
                type="button"
                aria-label="Change profile photo"
                onClick={handleAvatarClick}
                className={`group relative rounded-full transition-smooth ${
                  isEditing
                    ? "cursor-pointer ring-2 ring-primary/50 ring-offset-2 ring-offset-background"
                    : "cursor-default"
                }`}
                data-ocid="profile.avatar.upload_button"
              >
                <Avatar key={displayPhoto ?? "fallback"} className="h-24 w-24">
                  {displayPhoto && (
                    <AvatarImage src={displayPhoto} alt={user.fullname} />
                  )}
                  <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold font-display">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <div className="absolute inset-0 rounded-full bg-foreground/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-smooth">
                    <Camera className="h-6 w-6 text-background" />
                  </div>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                data-ocid="profile.photo.input"
              />
            </div>

            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h1 className="font-display font-bold text-xl text-foreground truncate">
                {user.fullname}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                {user.email}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {(cleanPosition || "Staff") + " - " + user.department}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Badge variant={roleBadgeVariant(user.role)}>
                  <Shield className="h-3 w-3 mr-1" />
                  {roleLabel(user.role)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <MapPin className="h-3 w-3 mr-1" />
                  {user.branch}
                </Badge>
                {user.isActive ? (
                  <Badge
                    variant="outline"
                    className="text-xs border-secondary text-secondary"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-xs border-destructive text-destructive"
                  >
                    Inactive
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Last seen: {formatLastSeen(user.lastSeen)}
              </p>
            </div>

            {!isEditing ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="flex-shrink-0 gap-1.5"
                data-ocid="profile.edit_button"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                className="flex-shrink-0 gap-1.5 text-muted-foreground"
                data-ocid="profile.cancel_edit_button"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
            )}
          </div>
        </PortalCard>

        <PortalCard
          title={isEditing ? "Edit Profile" : "Profile Details"}
          subtitle={isEditing ? "Update your personal information" : undefined}
          data-ocid="profile.details.card"
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="profile-fullname">Full Name</Label>
              {isEditing ? (
                <Input
                  id="profile-fullname"
                  value={fullname}
                  onChange={(event) => setFullname(event.target.value)}
                />
              ) : (
                <InfoRow
                  icon={<UserIcon className="h-4 w-4" />}
                  label="Full Name"
                  value={user.fullname}
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-phone">Phone Number</Label>
              {isEditing ? (
                <Input
                  id="profile-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              ) : (
                <InfoRow
                  icon={<Phone className="h-4 w-4" />}
                  label="Phone"
                  value={user.phone || "Not provided"}
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-department">Department</Label>
              {isEditing && isPrivileged ? (
                <Select
                  value={department}
                  onValueChange={(value) => {
                    setDepartment(value);
                    setItCode("");
                    setItCodeError("");
                  }}
                >
                  <SelectTrigger id="profile-department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <InfoRow
                  icon={<Building2 className="h-4 w-4" />}
                  label="Department"
                  value={user.department}
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-branch">Branch</Label>
              {isEditing && isPrivileged ? (
                <Select value={branch} onValueChange={setBranch}>
                  <SelectTrigger id="profile-branch">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANCHES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <InfoRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Branch"
                  value={user.branch}
                />
              )}
            </div>

            {isChangingToIT && (
              <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <Label htmlFor="profile-it-code">
                  IT Access Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="profile-it-code"
                  type="password"
                  value={itCode}
                  onChange={(event) => {
                    setItCode(event.target.value);
                    setItCodeError("");
                  }}
                  placeholder="Enter IT access code"
                  data-ocid="profile.it_code.input"
                />
                {itCodeError && (
                  <p className="text-xs text-destructive" data-ocid="profile.it_code.error_state">
                    {itCodeError}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Switching into IT will update your role to Super Admin immediately after save.
                </p>
              </div>
            )}

            {isEditing && (
              <div className="flex flex-wrap gap-3 pt-2">
                {hasExistingProfilePhoto && !removePhoto && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRemovePhoto}
                    className="gap-2"
                  >
                    <ImageOff className="h-4 w-4" />
                    Remove Photo
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="min-w-0 gap-2 glass-button text-primary-foreground"
                  data-ocid="profile.save_button"
                >
                  {isSaving ? (
                    <>
                      <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </PortalCard>

        <PortalCard
          title="Account Information"
          subtitle="Read-only account details"
          data-ocid="profile.account.card"
        >
          <div className="space-y-3">
            <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={user.email} />
            <InfoRow
              icon={<Calendar className="h-4 w-4" />}
              label="Registered"
                value={formatRegisteredAt(user.registrationTime)}
            />
            <InfoRow
              icon={<Shield className="h-4 w-4" />}
              label="Role"
              value={roleLabel(user.role)}
            />
          </div>
        </PortalCard>

        <PortalCard data-ocid="profile.logout.card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-foreground">Sign out</h3>
              <p className="text-sm text-muted-foreground">
                End your current portal session on this device.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setShowLogoutConfirm(true)}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </PortalCard>
      </div>

      <ConfirmDialog
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        title="Log out?"
        description="You will need to sign in again to continue."
        confirmLabel="Log out"
        onConfirm={handleLogout}
      />
    </AppShell>
  );
}
