import { useEffect } from 'react';
import { Gem, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { eventConfig } from '../config/event';
import { EVENT_CODE_QUERY_PARAM } from '../lib/eventCode';

/** Printable card for the tables. Unlinked route: /qr */
export function QrPage() {
  const url = new URL(eventConfig.siteUrl);
  if (eventConfig.eventCode) url.searchParams.set(EVENT_CODE_QUERY_PARAM, eventConfig.eventCode);
  const link = url.toString();

  useEffect(() => {
    document.title = `QR · ${eventConfig.title}`;
  }, []);

  return (
    <main className="page qr-page">
      <section className="card card--center qr-card">
        <h1>
          {eventConfig.coupleNames}
          <Gem className="icon icon--lead" aria-hidden="true" />
        </h1>
        <p className="lead">סרקו כדי לשתף איתנו את התמונות שלכם מהחתונה</p>
        <QRCodeSVG value={link} size={320} level="M" marginSize={2} title={link} />
        {eventConfig.eventCode && (
          <p className="qr-card__code">
            קוד האירוע: <strong dir="ltr">{eventConfig.eventCode}</strong>
          </p>
        )}
        <p className="qr-card__url" dir="ltr">
          {eventConfig.siteUrl}
        </p>
      </section>
      <p className="qr-page__hint no-print">
        <button type="button" className="btn btn--primary" onClick={() => window.print()}>
          <Printer className="icon" aria-hidden="true" />
          הדפסה
        </button>
      </p>
    </main>
  );
}

export const Component = QrPage;
