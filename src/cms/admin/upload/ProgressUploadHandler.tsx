"use client";

import { createClientUploadHandler } from "@payloadcms/plugin-cloud-storage/client";
import { formatAdminURL } from "payload/shared";
import { emitUploadProgress } from "./progress";

/**
 * Direct-to-storage uploads with progress.
 *
 * Same protocol as Payload's S3 client handler (ask the server for a presigned PUT,
 * then upload straight to Bunny Storage), but via XMLHttpRequest so the admin can show
 * a real progress bar and the browser can cancel. Large videos never pass through Next.js.
 */
export const ProgressUploadHandler = createClientUploadHandler<{ maxBytes?: number }>({
  handler: async ({ apiRoute, collectionSlug, docPrefix, file, serverHandlerPath, serverURL, updateFilename, extra }) => {
    const id = `${collectionSlug}:${file.name}:${file.size}:${Date.now()}`;
    const maxBytes = extra?.maxBytes;
    if (maxBytes && file.size > maxBytes) {
      const message = `“${file.name}” is ${(file.size / 1024 / 1024).toFixed(0)} MB. The limit is ${Math.round(maxBytes / 1024 / 1024)} MB.`;
      emitUploadProgress({ id, name: file.name, loaded: 0, total: file.size, state: "error", message });
      throw new Error(message);
    }

    emitUploadProgress({ id, name: file.name, loaded: 0, total: file.size, state: "preparing" });
    const signRes = await fetch(formatAdminURL({ apiRoute, path: serverHandlerPath, serverURL }), {
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ collectionSlug, docPrefix, filename: file.name, filesize: file.size, mimeType: file.type }),
    });
    if (!signRes.ok) {
      const { errors } = (await signRes.json().catch(() => ({ errors: [] }))) as { errors?: { message: string }[] };
      const message = errors?.map((e) => e.message).join(", ") || `Couldn't start the upload (${signRes.status}).`;
      emitUploadProgress({ id, name: file.name, loaded: 0, total: file.size, state: "error", message });
      throw new Error(message);
    }
    const { clientUploadContext, filename, headers, url } = (await signRes.json()) as {
      clientUploadContext: { prefix: string; signedReceipt: unknown };
      filename?: string;
      headers?: Record<string, string>;
      url: string;
    };
    if (filename && filename !== file.name) updateFilename(filename);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      for (const [key, value] of Object.entries(headers ?? {})) xhr.setRequestHeader(key, value);
      xhr.upload.onprogress = (e) => emitUploadProgress({ id, name: file.name, loaded: e.loaded, total: e.total || file.size, state: "uploading" });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          emitUploadProgress({ id, name: file.name, loaded: file.size, total: file.size, state: "done" });
          resolve();
        } else {
          const message = `Upload failed (${xhr.status}). Check your connection and try again.`;
          emitUploadProgress({ id, name: file.name, loaded: 0, total: file.size, state: "error", message });
          reject(new Error(message));
        }
      };
      xhr.onerror = () => {
        const message = "Upload interrupted. Check your connection and try again.";
        emitUploadProgress({ id, name: file.name, loaded: 0, total: file.size, state: "error", message });
        reject(new Error(message));
      };
      xhr.send(file);
    });

    return { prefix: clientUploadContext.prefix, signedReceipt: clientUploadContext.signedReceipt };
  },
});
