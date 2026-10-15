export type UploadState = "preparing" | "uploading" | "done" | "error";

export interface UploadProgress {
  id: string;
  name: string;
  loaded: number;
  total: number;
  state: UploadState;
  message?: string;
}

const EVENT = "gen-e:upload-progress";

export function emitUploadProgress(detail: UploadProgress) {
  window.dispatchEvent(new CustomEvent<UploadProgress>(EVENT, { detail }));
}

export function onUploadProgress(listener: (p: UploadProgress) => void) {
  const handler = (e: Event) => listener((e as CustomEvent<UploadProgress>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
