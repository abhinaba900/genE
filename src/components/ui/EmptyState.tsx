import Link from "next/link";
import { cn } from "@/lib/cn";

export function EmptyState({
  title,
  description,
  action,
  tone = "light",
  className,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-20 text-center", className)}>
      <span aria-hidden className={cn("mb-6 block h-px w-10", dark ? "bg-white/30" : "bg-ink/25")} />
      <h2 className={cn("max-w-md font-serif text-3xl leading-tight tracking-tight", dark ? "text-white" : "text-ink")}>
        {title}
      </h2>
      {description && (
        <p className={cn("mt-3 max-w-sm text-[15px] leading-relaxed", dark ? "text-white/65" : "text-muted")}>
          {description}
        </p>
      )}
      {action && (
        <Link
          href={action.href}
          className={cn(
            "mt-8 inline-flex min-h-11 items-center rounded-full px-6 text-sm font-medium transition-colors",
            dark ? "bg-white text-ink hover:bg-white/85" : "bg-ink text-white hover:bg-ink-2",
          )}
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
