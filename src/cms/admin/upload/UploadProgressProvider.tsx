"use client";

import { useEffect, useState } from "react";
import { type UploadProgress, onUploadProgress } from "./progress";

/**
 * Floating upload tray. Shows every direct-to-storage upload with its progress, wherever
 * it was started (story editor drawer, media library, bulk upload).
 */
export function UploadProgressProvider({ children }: { children: React.ReactNode }) {
  const [uploads, setUploads] = useState<Record<string, UploadProgress>>({});

  useEffect(
    () =>
      onUploadProgress((p) => {
        setUploads((current) => ({ ...current, [p.id]: p }));
        if (p.state === "done") {
          setTimeout(() => setUploads(({ [p.id]: _, ...rest }) => rest), 2500);
        }
      }),
    [],
  );

  const items = Object.values(uploads);
  return (
    <>
      {children}
      {items.length > 0 && (
        <div className="gene-upload-tray" role="status" aria-live="polite">
          {items.map((u) => {
            const pct = u.total ? Math.round((u.loaded / u.total) * 100) : 0;
            return (
              <div key={u.id} className="gene-upload-tray__item" data-state={u.state}>
                <div className="gene-upload-tray__row">
                  <span className="gene-upload-tray__name" title={u.name}>
                    {u.name}
                  </span>
                  <span className="gene-upload-tray__pct">
                    {u.state === "preparing" && "Preparing…"}
                    {u.state === "uploading" && `${pct}%`}
                    {u.state === "done" && "Uploaded"}
                    {u.state === "error" && (
                      <button type="button" onClick={() => setUploads(({ [u.id]: _, ...rest }) => rest)}>
                        Dismiss
                      </button>
                    )}
                  </span>
                </div>
                <div className="gene-upload-tray__bar" aria-hidden>
                  <span style={{ width: `${u.state === "done" ? 100 : pct}%` }} />
                </div>
                {u.state === "uploading" && (
                  <p className="gene-upload-tray__meta">
                    {(u.loaded / 1024 / 1024).toFixed(1)} of {(u.total / 1024 / 1024).toFixed(1)} MB — keep this tab open
                  </p>
                )}
                {u.message && <p className="gene-upload-tray__error">{u.message}</p>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
