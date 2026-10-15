"use client";

import { ExternalLink, Monitor, Smartphone } from "lucide-react";

export function HomepagePreviewHint() {
  return (
    <div className="gene-callout">
      <p>
        <strong>Live Preview</strong> (top right) shows this draft on the real site. Switch between Mobile and Desktop sizes there. Changes
        go live only when you click <strong>Publish changes</strong>.
      </p>
      <p className="gene-callout__links">
        <a href="/preview/home" target="_blank" rel="noopener">
          <Smartphone size={14} aria-hidden /> <Monitor size={14} aria-hidden /> Open draft homepage <ExternalLink size={12} aria-hidden />
        </a>
      </p>
      <p className="gene-help">
        Feed order is always: pinned stories → ordering rule → newest first. Only published stories appear; scheduled and archived stories
        never do, even if they are listed here.
      </p>
    </div>
  );
}
