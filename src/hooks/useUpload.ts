import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { eventConfig } from '../config/event';
import { runWithConcurrency } from '../lib/concurrency';
import { uploadOne, UploadCancelledError, type UploadMeta } from '../lib/upload';
import { validateFile } from '../lib/validateFile';

export type UploadStatus = 'queued' | 'compressing' | 'uploading' | 'done' | 'error';

export interface UploadItem {
  id: string;
  file: File;
  previewUrl: string;
  status: UploadStatus;
  /** 0..1, meaningful while `uploading`. */
  progress: number;
  error?: string;
}

export interface RejectedFile {
  file: File;
  reason: string;
}

export interface UploadSummary {
  done: number;
  failed: number;
}

export interface UseUploadResult {
  items: UploadItem[];
  isUploading: boolean;
  doneCount: number;
  errorCount: number;
  /** Adds files to the queue; returns the ones that were rejected up front. */
  addFiles: (files: File[]) => RejectedFile[];
  removeFile: (id: string) => void;
  reset: () => void;
  start: (meta: UploadMeta) => Promise<UploadSummary>;
  retry: (id: string, meta: UploadMeta) => Promise<UploadSummary>;
}

export const UPLOAD_CONCURRENCY = 2;

let counter = 0;
function nextId(): string {
  counter += 1;
  return `u${Date.now().toString(36)}-${counter}`;
}

export function useUpload(uid: string | null | undefined): UseUploadResult {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const itemsRef = useRef<UploadItem[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const patch = useCallback((id: string, changes: Partial<UploadItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }, []);

  const addFiles = useCallback((files: File[]): RejectedFile[] => {
    const rejected: RejectedFile[] = [];
    const accepted: UploadItem[] = [];
    const room = eventConfig.limits.maxFilesPerBatch - itemsRef.current.length;

    for (const file of files) {
      const check = validateFile(file);
      if (!check.ok) {
        rejected.push({ file, reason: check.reason });
        continue;
      }
      if (accepted.length >= room) {
        rejected.push({
          file,
          reason: `אפשר להעלות עד ${eventConfig.limits.maxFilesPerBatch} קבצים בכל פעם.`,
        });
        continue;
      }
      accepted.push({
        id: nextId(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'queued',
        progress: 0,
      });
    }

    if (accepted.length > 0) setItems((prev) => [...prev, ...accepted]);
    return rejected;
  }, []);

  const removeFile = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setItems((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    setIsUploading(false);
  }, []);

  const runItems = useCallback(
    async (targets: UploadItem[], meta: UploadMeta): Promise<UploadSummary> => {
      if (!uid) throw new Error('ההתחברות עדיין לא הושלמה. נסו שוב בעוד רגע.');
      if (targets.length === 0) return { done: 0, failed: 0 };

      const controller = new AbortController();
      abortRef.current = controller;
      setIsUploading(true);

      const tasks = targets.map((item) => async () => {
        patch(item.id, { status: 'compressing', progress: 0, error: undefined });
        try {
          await uploadOne(item.file, meta, {
            uid,
            signal: controller.signal,
            onStage: (stage) => patch(item.id, { status: stage }),
            onProgress: (progress) => patch(item.id, { progress }),
          });
          patch(item.id, { status: 'done', progress: 1 });
        } catch (error) {
          const message =
            error instanceof UploadCancelledError
              ? error.message
              : error instanceof Error
                ? error.message
                : 'ההעלאה נכשלה';
          patch(item.id, { status: 'error', error: message });
          throw error;
        }
      });

      const results = await runWithConcurrency(tasks, UPLOAD_CONCURRENCY);
      if (abortRef.current === controller) abortRef.current = null;
      setIsUploading(false);

      const done = results.filter((r) => r.status === 'fulfilled').length;
      return { done, failed: results.length - done };
    },
    [patch, uid],
  );

  const start = useCallback(
    (meta: UploadMeta) =>
      runItems(
        itemsRef.current.filter((item) => item.status === 'queued' || item.status === 'error'),
        meta,
      ),
    [runItems],
  );

  const retry = useCallback(
    (id: string, meta: UploadMeta) => {
      const target = itemsRef.current.find((item) => item.id === id);
      return runItems(target ? [target] : [], meta);
    },
    [runItems],
  );

  const doneCount = useMemo(() => items.filter((i) => i.status === 'done').length, [items]);
  const errorCount = useMemo(() => items.filter((i) => i.status === 'error').length, [items]);

  return { items, isUploading, doneCount, errorCount, addFiles, removeFile, reset, start, retry };
}
