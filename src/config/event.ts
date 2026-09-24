const MB = 1024 * 1024;

/**
 * Single place for everything specific to this wedding.
 * Values that must not live in the public repo come from `.env.local`.
 */
export const eventConfig = {
  coupleNames: 'רוני ולי',
  title: 'החתונה של רוני ולי',
  subtitle: 'נשמח שתשתפו איתנו את הרגעים שלכם!',
  siteUrl: (import.meta.env.VITE_SITE_URL ?? 'https://wedding-album-b0cf7.web.app').replace(
    /\/+$/,
    '',
  ),
  /** Shared code printed on the QR cards. Empty string disables the gate. */
  eventCode: (import.meta.env.VITE_EVENT_CODE ?? '').trim(),
  limits: {
    /** Max size of an image after client-side compression (mirrors storage.rules). */
    imageMaxBytes: 10 * MB,
    /** Max size of a video; videos are uploaded as-is (mirrors storage.rules). */
    videoMaxBytes: 50 * MB,
    /** Max size of a thumbnail (mirrors storage.rules). */
    thumbMaxBytes: 512 * 1024,
    maxFilesPerBatch: 30,
    captionMax: 200,
    guestNameMax: 50,
  },
  compression: {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
  },
  thumb: {
    maxSizeMB: 0.1,
    maxWidthOrHeight: 400,
  },
  feed: {
    pageSize: 30,
  },
} as const;

export type EventConfig = typeof eventConfig;
