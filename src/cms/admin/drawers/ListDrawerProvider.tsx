"use client";

import { useDocumentDrawer } from "@payloadcms/ui";
import { useRouter } from "next/navigation";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

/** Read-only logs keep their full page; everything else edits in a drawer. */
const SKIP = new Set(["audit-events", "analytics-events"]);
const DOC_PATH = /^\/admin\/collections\/([^/]+)\/(\d+|create)\/?$/;

type Target = { collection: string; id?: number; key: number };

/**
 * Opens documents from Payload's list views in a slide-over drawer instead of navigating.
 * Plain clicks on a row link or the "Create New" button are intercepted; Ctrl/Cmd/Shift-click
 * and middle-click still open the full editor, so nothing is lost.
 */
export function ListDrawerProvider({ children }: { children?: React.ReactNode }) {
  const [target, setTarget] = useState<Target | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!link || !link.closest(".collection-list") || link.getAttribute("target") === "_blank") return;
      const match = new URL(link.getAttribute("href")!, window.location.origin).pathname.match(DOC_PATH);
      if (!match || SKIP.has(match[1])) return;
      // Capture phase on document runs before React's root listener, so Next's <Link> never navigates.
      event.preventDefault();
      event.stopPropagation();
      setTarget({ collection: match[1], id: match[2] === "create" ? undefined : Number(match[2]), key: Date.now() });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const close = useCallback(() => setTarget(null), []);

  return (
    <>
      {children}
      {target && <ActiveDrawer key={target.key} collection={target.collection} id={target.id} onClose={close} />}
    </>
  );
}

function ActiveDrawer({ collection, id, onClose }: { collection: string; id?: number; onClose: () => void }) {
  const router = useRouter();
  const [Drawer, , { openDrawer, isDrawerOpen }] = useDocumentDrawer({ collectionSlug: collection, id });
  const opened = useRef(false);
  const refresh = () => router.refresh();

  useEffect(() => {
    openDrawer();
    // Opens once per mount; a new click remounts this component with a new key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isDrawerOpen) opened.current = true;
    else if (opened.current) onClose();
  }, [isDrawerOpen, onClose]);

  return <Drawer onSave={refresh} onDelete={refresh} onDuplicate={refresh} redirectAfterCreate={false} redirectAfterDelete={false} />;
}
