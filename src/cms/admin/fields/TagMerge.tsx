"use client";

import { toast, useAuth, useConfig, useDocumentInfo } from "@payloadcms/ui";
import { GitMerge } from "lucide-react";
import { useEffect, useState } from "react";

/** Merge this tag into another: every story moves to the target tag, then this one is removed. */
export function TagMerge() {
  const { id, title } = useDocumentInfo();
  const { user } = useAuth<{ role?: string }>();
  const { config } = useConfig();
  const api = `${config.serverURL}${config.routes.api}`;
  const [tags, setTags] = useState<{ id: number; name: string }[]>([]);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const canMerge = user?.role === "admin" || user?.role === "editor";

  useEffect(() => {
    if (!canMerge) return;
    fetch(`${api}/tags?limit=500&sort=name&depth=0&select[name]=true`, { credentials: "include" })
      .then((r) => r.json())
      .then((r) => setTags((r.docs ?? []).filter((t: { id: number }) => String(t.id) !== String(id))))
      .catch(() => {});
  }, [api, id, canMerge]);

  if (!canMerge || !id) return null;

  async function merge() {
    const into = tags.find((t) => String(t.id) === target);
    if (!into || !window.confirm(`Merge “${title}” into “${into.name}”? All stories will use “${into.name}” and “${title}” will be deleted.`)) return;
    setBusy(true);
    const res = await fetch(`${api}/tags/${id}/merge`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ into: into.id }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(body.message ?? "Couldn't merge tags.");
      setBusy(false);
      return;
    }
    toast.success(body.message);
    window.location.href = `/admin/collections/tags/${into.id}`;
  }

  return (
    <div className="gene-workflow">
      <p className="gene-workflow__label">Merge duplicate</p>
      <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Merge into tag" className="gene-select">
        <option value="">Merge into…</option>
        {tags.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button type="button" className="gene-btn" disabled={!target || busy} onClick={merge}>
        <GitMerge size={15} aria-hidden /> {busy ? "Merging…" : "Merge"}
      </button>
    </div>
  );
}
