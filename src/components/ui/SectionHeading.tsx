import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export function SectionHeading({
  id,
  title,
  kicker,
  link,
  as: Heading = "h2",
  className,
}: {
  id: string;
  title: string;
  kicker?: string;
  link?: { label: string; href: string };
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-6 border-b border-line pb-5", className)}>
      <div>
        {kicker && <p className="kicker mb-2 text-muted">{kicker}</p>}
        <Heading id={id} className="font-serif text-[30px] leading-none tracking-[-0.02em] text-ink md:text-[38px]">
          {title}
        </Heading>
      </div>
      {link && (
        <Link
          href={link.href}
          className="group inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-medium text-ink ring-1 ring-ink/15 transition-colors hover:bg-ink hover:text-white"
        >
          {link.label}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}
