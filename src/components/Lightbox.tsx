import { useMemo } from 'react';
import Lightbox, { type Slide } from 'yet-another-react-lightbox';
import Captions from 'yet-another-react-lightbox/plugins/captions';
import Download from 'yet-another-react-lightbox/plugins/download';
import Video from 'yet-another-react-lightbox/plugins/video';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/captions.css';
import { videoMimeFromPath, type MediaItem } from '../types/media';

interface Props {
  items: MediaItem[];
  /** -1 when closed. */
  index: number;
  onClose: () => void;
}

function fileNameFor(item: MediaItem): string {
  return item.storagePath.split('/').pop() ?? `${item.id}.${item.type === 'video' ? 'mp4' : 'jpg'}`;
}

function toSlide(item: MediaItem): Slide {
  const common = {
    title: item.guestName,
    description: item.caption,
    download: { url: item.url, filename: fileNameFor(item) },
  };
  if (item.type === 'video') {
    return {
      ...common,
      type: 'video',
      sources: [{ src: item.url, type: videoMimeFromPath(item.storagePath) }],
      controls: true,
      playsInline: true,
    };
  }
  return {
    ...common,
    src: item.url,
    alt: item.guestName ? `רגע מהחתונה מאת ${item.guestName}` : 'רגע מהחתונה',
  };
}

export default function MediaLightbox({ items, index, onClose }: Props) {
  const slides = useMemo(() => items.map(toSlide), [items]);
  return (
    <Lightbox
      open={index >= 0}
      index={Math.max(0, index)}
      close={onClose}
      slides={slides}
      plugins={[Video, Zoom, Captions, Download]}
      carousel={{ preload: 2 }}
      zoom={{ maxZoomPixelRatio: 3 }}
      captions={{ descriptionTextAlign: 'center', showToggle: true }}
      controller={{ closeOnBackdropClick: true }}
    />
  );
}
