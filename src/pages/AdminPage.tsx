import { useEffect, useState, type FormEvent } from 'react';
import { signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { LoadMore } from '../components/LoadMore';
import { MediaCard } from '../components/MediaCard';
import { eventConfig } from '../config/event';
import { useAuth } from '../hooks/useAuth';
import { useMediaFeed } from '../hooks/useMediaFeed';
import { useToast } from '../hooks/useToast';
import { auth, db, storage } from '../lib/firebase';
import { downloadAsZips, type ZipProgress } from '../lib/zipDownload';
import type { MediaItem } from '../types/media';

type Role = 'checking' | 'guest' | 'admin';

async function resolveRole(user: User | null): Promise<Role> {
  if (!user) return 'checking';
  if (user.isAnonymous) return 'guest';
  const token = await user.getIdTokenResult();
  return token.claims.admin === true ? 'admin' : 'guest';
}

async function deleteBlob(path: string | undefined): Promise<void> {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (error) {
    // Missing object is fine (already gone); anything else should surface.
    if ((error as { code?: string }).code !== 'storage/object-not-found') throw error;
  }
}

function AdminLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const token = await credential.user.getIdTokenResult(true);
      if (token.claims.admin !== true) {
        await signOut(auth);
        toast.show('למשתמש הזה אין הרשאות ניהול.', 'error');
        return;
      }
      onSignedIn();
    } catch {
      toast.show('ההתחברות נכשלה. בדקו אימייל וסיסמה.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card card--center">
      <h2>כניסת מנהלים</h2>
      <form className="stack" onSubmit={onSubmit}>
        <label className="field">
          <span className="field__label">אימייל</span>
          <input
            className="input"
            type="email"
            autoComplete="username"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="field__label">סיסמה</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'מתחבר…' : 'כניסה'}
        </button>
      </form>
    </section>
  );
}

function AdminGallery() {
  const toast = useToast();
  const feed = useMediaFeed({ includeHidden: true, pageSize: 60 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeVideos, setIncludeVideos] = useState(false);
  const [zipProgress, setZipProgress] = useState<ZipProgress | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setHidden = async (item: MediaItem, hidden: boolean) => {
    setBusyId(item.id);
    try {
      await updateDoc(doc(db, 'media', item.id), { hidden });
      feed.patchLocal(item.id, { hidden });
    } catch {
      toast.show('העדכון נכשל.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item: MediaItem) => {
    if (!window.confirm('למחוק לצמיתות? אי אפשר לשחזר.')) return;
    setBusyId(item.id);
    try {
      await deleteDoc(doc(db, 'media', item.id));
      await deleteBlob(item.storagePath);
      await deleteBlob(item.thumbPath);
      feed.removeLocal(item.id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    } catch {
      toast.show('המחיקה נכשלה.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const loadAll = async () => {
    // Pull every remaining page so "download all" really means all.
    let guard = 0;
    while (feed.hasMore && guard < 200) {
      await feed.loadMore();
      guard += 1;
    }
  };

  const download = async (onlySelected: boolean) => {
    const pool = onlySelected ? feed.items.filter((i) => selected.has(i.id)) : feed.items;
    const targets = pool.filter((i) => includeVideos || i.type === 'image');
    if (targets.length === 0) {
      toast.show('אין מה להוריד.', 'info');
      return;
    }
    setZipProgress({ fetched: 0, total: targets.length, zipsCreated: 0 });
    try {
      const { added, skipped } = await downloadAsZips(targets, setZipProgress);
      toast.show(
        skipped ? `${added} הורדו, ${skipped} דולגו (בדקו CORS).` : `${added} קבצים נארזו.`,
        skipped ? 'error' : 'success',
      );
    } finally {
      setZipProgress(null);
    }
  };

  if (feed.status === 'loading') return <p className="muted">טוען…</p>;
  if (feed.status === 'error') {
    return (
      <p className="error" role="alert">
        הטעינה נכשלה: {feed.error}
      </p>
    );
  }

  const hiddenCount = feed.items.filter((i) => i.hidden).length;

  return (
    <>
      <div className="admin__toolbar">
        <span className="muted">
          {feed.items.length} פריטים{feed.hasMore ? '+' : ''} · {hiddenCount} מוסתרים ·{' '}
          {selected.size} נבחרו
        </span>
        <label className="check">
          <input
            type="checkbox"
            checked={includeVideos}
            onChange={(e) => setIncludeVideos(e.target.checked)}
          />
          לכלול סרטונים בהורדה
        </label>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setSelected(new Set(feed.items.map((i) => i.id)))}
        >
          בחירת הכול
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setSelected(new Set())}>
          ניקוי בחירה
        </button>
        <button
          type="button"
          className="btn btn--outline"
          disabled={selected.size === 0 || zipProgress !== null}
          onClick={() => download(true)}
        >
          הורדת הנבחרים
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={zipProgress !== null}
          onClick={async () => {
            await loadAll();
            await download(false);
          }}
        >
          הורדת הכול (ZIP)
        </button>
        {zipProgress && (
          <span className="muted" role="status">
            אורז… {zipProgress.fetched}/{zipProgress.total}
          </span>
        )}
      </div>

      <div className="gallery-grid gallery-grid--admin">
        {feed.items.map((item) => (
          <MediaCard key={item.id} item={item}>
            <div className="media-card__actions">
              <label className="check check--overlay">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                  aria-label="בחירה"
                />
              </label>
              <button
                type="button"
                className="chip"
                disabled={busyId === item.id}
                onClick={() => setHidden(item, !item.hidden)}
              >
                {item.hidden ? 'הצגה' : 'הסתרה'}
              </button>
              <button
                type="button"
                className="chip chip--danger"
                disabled={busyId === item.id}
                onClick={() => remove(item)}
              >
                מחיקה
              </button>
            </div>
          </MediaCard>
        ))}
      </div>
      <LoadMore hasMore={feed.hasMore} loading={feed.loadingMore} onLoadMore={feed.loadMore} />
    </>
  );
}

export function AdminPage() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role>('checking');

  useEffect(() => {
    document.title = `ניהול · ${eventConfig.title}`;
  }, []);

  useEffect(() => {
    let active = true;
    resolveRole(user)
      .then((next) => active && setRole(next))
      .catch(() => active && setRole('guest'));
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <main className="page page--wide">
      <header className="page__header page__header--row">
        <h1>ניהול האלבום</h1>
        {role === 'admin' && (
          <button type="button" className="btn btn--ghost" onClick={() => signOut(auth)}>
            יציאה
          </button>
        )}
      </header>

      {role === 'checking' && <p className="muted">בודק הרשאות…</p>}
      {role === 'guest' && <AdminLogin onSignedIn={() => setRole('admin')} />}
      {role === 'admin' && (
        <section className="card admin">
          <AdminGallery />
        </section>
      )}
    </main>
  );
}

export const Component = AdminPage;
