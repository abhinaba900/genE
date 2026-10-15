"use client";

import { useEffect } from "react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-[720px] flex-col justify-center px-5 py-20">
      <p className="kicker text-muted">Something went wrong</p>
      <h1 className="mt-5 font-serif text-[44px] leading-tight tracking-tight text-ink">We couldn’t load this page.</h1>
      <p className="mt-4 text-[16px] leading-relaxed text-muted">
        It may be a network hiccup. Try again, or head back to the homepage.
      </p>
      <div className="mt-8 flex gap-3">
        <button onClick={reset} className="inline-flex h-12 items-center rounded-full bg-ink px-6 text-[15px] font-medium text-white">
          Try again
        </button>
        {/* Plain anchor: forces a full reload in case the client router is what failed. */}
        <a href="/" className="inline-flex h-12 items-center rounded-full px-6 text-[15px] font-medium text-ink ring-1 ring-ink/15">
          Homepage
        </a>
      </div>
    </main>
  );
}
