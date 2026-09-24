import { useEffect } from 'react';
import { Gem, Images } from 'lucide-react';
import { EventCodeGate } from '../components/EventCodeGate';
import { Gallery } from '../components/Gallery';
import { Uploader } from '../components/Uploader';
import { eventConfig } from '../config/event';
import { useAuth } from '../hooks/useAuth';

export function GuestPage() {
  const { user, status } = useAuth();

  useEffect(() => {
    document.title = eventConfig.title;
  }, []);

  return (
    <main className="page">
      <header className="page__header">
        <h1>
          {eventConfig.title}
          <Gem className="icon icon--lead" aria-hidden="true" />
        </h1>
        <p className="lead">{eventConfig.subtitle}</p>
      </header>

      {status === 'error' && (
        <p className="error" role="alert">
          לא הצלחנו להתחבר לשרת. בדקו את החיבור לאינטרנט ורעננו את הדף.
        </p>
      )}

      <EventCodeGate>
        <section className="card" aria-labelledby="upload-title">
          <h2 id="upload-title">שיתוף תמונות</h2>
          <Uploader uid={user?.uid ?? null} />
        </section>

        <section className="card" aria-labelledby="gallery-title">
          <h2 id="gallery-title">
            <Images className="icon" aria-hidden="true" /> גלריית האירוע
          </h2>
          <Gallery enabled={status === 'ready'} />
        </section>
      </EventCodeGate>
    </main>
  );
}

export const Component = GuestPage;
