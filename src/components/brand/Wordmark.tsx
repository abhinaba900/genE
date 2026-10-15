import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

/** Official gen.E logo (source: scripts/brand/source/logo.webp; rebuilt by scripts/brand/build-brand-assets.mjs). */
const LOGO = { src: "/brand/gen-e-logo.png", width: 960, height: 298 };

/**
 * The gen.E logo, linked home. Size it with a height class (e.g. `h-8`); width follows the aspect ratio.
 * `onMedia` adds a soft shadow so the logo stays legible over video.
 */
export function Wordmark({
  className,
  href = "/",
  priority = false,
  onMedia = false,
}: {
  className?: string;
  href?: string;
  priority?: boolean;
  onMedia?: boolean;
}) {
  return (
    <Link href={href} aria-label="gen.E — home" className={cn("inline-flex shrink-0 items-center", className)}>
      <Image
        src={LOGO.src}
        alt="gen.E"
        width={LOGO.width}
        height={LOGO.height}
        priority={priority}
        sizes="200px"
        className={cn("h-full w-auto", onMedia && "drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)]")}
      />
    </Link>
  );
}
