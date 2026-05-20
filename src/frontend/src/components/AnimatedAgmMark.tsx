import { cn } from "@/lib/utils";

export function AnimatedAgmMark({
  className,
  size = 64,
  animate = true,
  label = "AGM app mark",
}: {
  className?: string;
  size?: number;
  animate?: boolean;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden border border-[#5abf95]/40 bg-[#1a5a46] shadow-[0_14px_34px_rgba(5,18,13,0.38)]",
        animate ? "agm-mark-shell agm-mark-pulse" : "",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label={label}
      role="img"
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0",
          animate ? "agm-mark-sheen" : "",
        )}
      />
      <svg
        viewBox="0 0 128 128"
        className={cn("h-[78%] w-[78%]", animate ? "agm-mark-core" : "")}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="agmPanel" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#2F8E68" />
            <stop offset="48%" stopColor="#23684D" />
            <stop offset="100%" stopColor="#173F31" />
          </linearGradient>
          <linearGradient id="agmGlow" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#F4FFF9" />
            <stop offset="100%" stopColor="#B7F2D4" />
          </linearGradient>
        </defs>

        <rect x="12" y="12" width="104" height="104" fill="url(#agmPanel)" opacity="0.96" />

        <path
          d="M73 31 96 54 96 86 73 108 40 108 25 93 25 54 48 31Z"
          fill="none"
          stroke="url(#agmGlow)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="5.5"
        />
        <path
          d="M70 43H51L39 55V84L51 96H72L86 82"
          fill="none"
          stroke="#F3FFF9"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="6.5"
        />
        <path
          d="M86 52V83H64"
          fill="none"
          stroke="#F3FFF9"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="6.5"
        />
      </svg>
    </div>
  );
}
