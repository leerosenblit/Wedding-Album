import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UploadOneOptions } from '../lib/upload';

const uploadOneMock =
  vi.fn<(file: File, meta: unknown, opts: UploadOneOptions) => Promise<string>>();

vi.mock('../lib/upload', () => ({
  uploadOne: uploadOneMock,
  UploadCancelledError: class extends Error {},
}));

const { useUpload, UPLOAD_CONCURRENCY } = await import('./useUpload');

function image(name: string): File {
  return new File([new Uint8Array(4)], name, { type: 'image/jpeg' });
}

describe('useUpload', () => {
  // Braces matter: a hook that *returns* the mock registers it as a cleanup callback.
  beforeEach(() => {
    uploadOneMock.mockReset();
  });

  it('queues valid files and reports rejected ones', () => {
    const { result } = renderHook(() => useUpload('uid-1'));
    const bad = new File([], 'doc.pdf', { type: 'application/pdf' });

    let rejected: ReturnType<typeof result.current.addFiles> = [];
    act(() => {
      rejected = result.current.addFiles([image('a.jpg'), bad]);
    });

    expect(rejected).toHaveLength(1);
    expect(rejected[0].file).toBe(bad);
    expect(result.current.items.map((i) => i.status)).toEqual(['queued']);
  });

  it('walks each item through compressing → uploading → done with progress', async () => {
    uploadOneMock.mockImplementation(async (_file, _meta, opts) => {
      opts.onStage?.('compressing');
      opts.onStage?.('uploading');
      opts.onProgress?.(0.5);
      opts.onProgress?.(1);
      return 'doc-id';
    });

    const { result } = renderHook(() => useUpload('uid-1'));
    act(() => {
      result.current.addFiles([image('a.jpg'), image('b.jpg')]);
    });

    let summary: { done: number; failed: number } | undefined;
    await act(async () => {
      summary = await result.current.start({ guestName: 'דנה' });
    });

    expect(summary).toEqual({ done: 2, failed: 0 });
    expect(result.current.items.every((i) => i.status === 'done' && i.progress === 1)).toBe(true);
    expect(result.current.isUploading).toBe(false);
    expect(uploadOneMock).toHaveBeenCalledTimes(2);
    expect(uploadOneMock.mock.calls[0][1]).toEqual({ guestName: 'דנה' });
    expect(uploadOneMock.mock.calls[0][2].uid).toBe('uid-1');
  });

  it('marks a failed item as error and lets it be retried', async () => {
    uploadOneMock.mockRejectedValueOnce(new Error('network')).mockResolvedValue('doc-id');

    const { result } = renderHook(() => useUpload('uid-1'));
    act(() => {
      result.current.addFiles([image('a.jpg')]);
    });

    await act(async () => {
      await expect(result.current.start({})).resolves.toEqual({ done: 0, failed: 1 });
    });
    expect(result.current.items[0].status).toBe('error');
    expect(result.current.items[0].error).toBe('network');

    const id = result.current.items[0].id;
    await act(async () => {
      await expect(result.current.retry(id, {})).resolves.toEqual({ done: 1, failed: 0 });
    });
    expect(result.current.items[0].status).toBe('done');
  });

  it('never has more than the concurrency limit in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    uploadOneMock.mockImplementation(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return 'id';
    });

    const { result } = renderHook(() => useUpload('uid-1'));
    act(() => {
      result.current.addFiles([image('1.jpg'), image('2.jpg'), image('3.jpg'), image('4.jpg')]);
    });
    await act(async () => {
      await result.current.start({});
    });

    expect(peak).toBe(UPLOAD_CONCURRENCY);
    await waitFor(() => expect(result.current.doneCount).toBe(4));
  });

  it('refuses to start before sign-in completes', async () => {
    const { result } = renderHook(() => useUpload(null));
    act(() => {
      result.current.addFiles([image('a.jpg')]);
    });
    await expect(result.current.start({})).rejects.toThrow();
    expect(uploadOneMock).not.toHaveBeenCalled();
  });
});
