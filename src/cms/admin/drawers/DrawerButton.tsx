"use client";

import { useDocumentDrawer } from "@payloadcms/ui";
import { useRouter } from "next/navigation";
import type React from "react";

type Props = {
  /** Collection to create in, or to edit in when `id` is given. */
  collection: string;
  id?: number | string;
  className?: string;
  /** Accessible name when the button shows only an icon. */
  label?: string;
  title?: string;
  children: React.ReactNode;
};

/**
 * Opens a create/edit form in a slide-over drawer instead of navigating away, then
 * refreshes the current server view so counts and lists reflect the change.
 */
export function DrawerButton({ collection, id, className, label, title, children }: Props) {
  const router = useRouter();
  const [Drawer, , { openDrawer }] = useDocumentDrawer({ collectionSlug: collection, id: id == null ? undefined : Number(id) });
  const refresh = () => router.refresh();

  return (
    <>
      <button type="button" className={className} onClick={openDrawer} aria-label={label} title={title ?? label}>
        {children}
      </button>
      <Drawer onSave={refresh} onDelete={refresh} onDuplicate={refresh} redirectAfterCreate={false} redirectAfterDelete={false} />
    </>
  );
}
