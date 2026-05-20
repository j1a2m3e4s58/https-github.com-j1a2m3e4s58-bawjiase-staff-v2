import { AnimatedAgmMark } from "@/components/AnimatedAgmMark";

export function AppSplashScreen({
  label = "Preparing AGM workspace",
}: {
  label?: string;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 bg-primary/10 blur-3xl" />
        <div className="absolute left-[18%] top-[16%] h-32 w-32 border border-primary/10 bg-primary/5" />
        <div className="absolute bottom-[14%] right-[12%] h-24 w-24 border border-border/50 bg-card/20" />
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
        <AnimatedAgmMark size={96} className="mb-6" label="AGM splash logo" />

        <p className="mb-2 font-display text-[0.72rem] font-semibold uppercase tracking-[0.42em] text-primary/80">
          AGM Pro
        </p>
        <h1 className="font-display text-3xl font-bold text-foreground">
          Annual General Meeting
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{label}</p>

        <div className="mt-8 w-full max-w-[14rem] overflow-hidden border border-border/70 bg-card/70 p-1">
          <div className="h-1.5 w-full overflow-hidden bg-muted/70">
            <div className="agm-splash-bar h-full w-1/2 bg-primary" />
          </div>
        </div>
      </div>
    </div>
  );
}
