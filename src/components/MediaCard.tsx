import { useState, type ReactNode } from 'react';
import type { MediaItem } from '../types/media';

interface Props {
  item: MediaItem;
  /** When provided, clicking the card calls this (e.g. opens the lightbox). */
  onOpen?: () => void;
  /** Optional overlay, e.g. admin actions. */
  children?: ReactNode;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.55)" />
      <path d="M9.5 7.5v9l7-4.5z" fill="#fff" />
    </svg>
  );
}

export function MediaCard({ item, onOpen, children }: Props) {
  const [playing, setPlaying] = useState(false);
  const alt = item.guestName ? `רגע מהחתונה מאת ${item.guestName}` : 'רגע מהחתונה';
  const badge = item.guestName ? <span className="media-card__badge">{item.guestName}</span> : null;

  if (item.type === 'video') {
    return (
      <div className={`media-card media-card--video${item.hidden ? ' media-card--hidden' : ''}`}>
        {playing ? (
          <video src={item.url} controls autoPlay playsInline preload="none" />
        ) : (
          <button
            type="button"
            className="media-card__button media-card__play"
            onClick={() => (onOpen ? onOpen() : setPlaying(true))}
            aria-label={item.guestName ? `נגן סרטון מאת ${item.guestName}` : 'נגן סרטון'}
          >
            <PlayIcon />
          </button>
        )}
        {badge}
        {children}
      </div>
    );
  }

  return (
    <div className={`media-card${item.hidden ? ' media-card--hidden' : ''}`}>
      <button
        type="button"
        className="media-card__button"
        onClick={onOpen}
        disabled={!onOpen}
        aria-label={onOpen ? `פתח ${alt}` : undefined}
      >
        <img src={item.thumbUrl ?? item.url} alt={alt} loading="lazy" decoding="async" />
      </button>
      {badge}
      {children}
    </div>
  );
}
