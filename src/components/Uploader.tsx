import { useState, type ChangeEvent, type FormEvent } from 'react';
import { eventConfig } from '../config/event';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useToast } from '../hooks/useToast';
import { useUpload, type UploadItem } from '../hooks/useUpload';

interface Props {
  /** Null until anonymous sign-in completes. */
  uid: string | null;
}

const GUEST_NAME_KEY = 'wedding:guestName';

function statusLabel(item: UploadItem): string {
  switch (item.status) {
    case 'compressing':
      return 'מכווץ…';
    case 'uploading':
      return `${Math.round(item.progress * 100)}%`;
    case 'done':
      return 'הועלה ✓';
    case 'error':
      return 'נכשל';
    default:
      return '';
  }
}

export function Uploader({ uid }: Props) {
  const upload = useUpload(uid);
  const toast = useToast();
  const [guestName, setGuestName] = useLocalStorage(GUEST_NAME_KEY);
  const [caption, setCaption] = useState('');

  const pending = upload.items.filter((item) => item.status !== 'done').length;
  const meta = { guestName, caption };

  const onFilesChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    for (const rejected of upload.addFiles(files)) {
      toast.show(`${rejected.file.name}: ${rejected.reason}`, 'error');
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const { done, failed } = await upload.start(meta);
      if (failed === 0) {
        toast.show(
          done === 1 ? 'הקובץ הועלה בהצלחה! 🎉' : `${done} קבצים הועלו בהצלחה! 🎉`,
          'success',
        );
        upload.reset();
        setCaption('');
      } else {
        toast.show(`${done} הועלו, ${failed} נכשלו. אפשר לנסות שוב.`, 'error');
      }
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'ההעלאה נכשלה', 'error');
    }
  };

  const onRetry = async (id: string) => {
    const { failed } = await upload.retry(id, meta);
    if (failed === 0) toast.show('הקובץ הועלה בהצלחה! 🎉', 'success');
  };

  const buttonLabel = upload.isUploading
    ? `מעלה… (${upload.doneCount}/${upload.items.length})`
    : pending > 0
      ? `🚀 שלחו ${pending === 1 ? 'קובץ אחד' : `${pending} קבצים`}`
      : 'ממתין לקבצים…';

  return (
    <form className="uploader" onSubmit={onSubmit}>
      <div className="uploader__meta">
        <label className="field">
          <span className="field__label">השם שלכם (לא חובה)</span>
          <input
            className="input"
            type="text"
            name="guestName"
            autoComplete="name"
            maxLength={eventConfig.limits.guestNameMax}
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            disabled={upload.isUploading}
          />
        </label>
        <label className="field">
          <span className="field__label">כמה מילים (לא חובה)</span>
          <input
            className="input"
            type="text"
            name="caption"
            maxLength={eventConfig.limits.captionMax}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={upload.isUploading}
          />
        </label>
      </div>

      <label className="file-picker">
        <input
          className="visually-hidden"
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={onFilesChosen}
          disabled={upload.isUploading}
          data-testid="file-input"
        />
        <span className="btn btn--outline" aria-hidden="true">
          📸 לחצו כאן לבחירת תמונות וסרטונים
        </span>
      </label>

      {upload.items.length > 0 && (
        <ul className="preview-strip" aria-label="קבצים שנבחרו">
          {upload.items.map((item) => (
            <li key={item.id} className={`preview preview--${item.status}`}>
              {item.file.type.startsWith('video/') ? (
                <video src={item.previewUrl} muted playsInline preload="metadata" />
              ) : (
                <img src={item.previewUrl} alt={item.file.name} />
              )}
              {item.status === 'uploading' && (
                <span
                  className="preview__bar"
                  style={{ width: `${Math.round(item.progress * 100)}%` }}
                />
              )}
              {item.status !== 'queued' && (
                <span className="preview__status">{statusLabel(item)}</span>
              )}
              {item.status === 'error' && (
                <button
                  type="button"
                  className="preview__action"
                  onClick={() => onRetry(item.id)}
                  title={item.error}
                >
                  נסו שוב
                </button>
              )}
              {(item.status === 'queued' || item.status === 'error') && !upload.isUploading && (
                <button
                  type="button"
                  className="preview__remove"
                  onClick={() => upload.removeFile(item.id)}
                  aria-label={`הסרת ${item.file.name}`}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="uploader__actions">
        <button
          type="submit"
          className="btn btn--primary"
          disabled={pending === 0 || upload.isUploading || !uid}
        >
          {buttonLabel}
        </button>
      </div>
    </form>
  );
}
