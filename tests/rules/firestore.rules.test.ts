import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { createEnv } from './helpers';

let env: RulesTestEnvironment;

const validDoc = (uid: string) => ({
  url: 'https://firebasestorage.googleapis.com/v0/b/x/o/uploads%2Fabc.jpg?alt=media',
  type: 'image',
  timestamp: serverTimestamp(),
  storagePath: 'uploads/0b1f4c9e-1c2d-4b8e-9f3a-abcdef012345.jpg',
  uid,
  hidden: false,
});

beforeAll(async () => {
  env = await createEnv();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe('media: create', () => {
  it('allows an anonymous signed-in guest to create a valid document', async () => {
    const db = env.authenticatedContext('guest-1').firestore();
    await assertSucceeds(addDoc(collection(db, 'media'), validDoc('guest-1')));
  });

  it('allows optional caption, guestName and thumbnail fields', async () => {
    const db = env.authenticatedContext('guest-1').firestore();
    await assertSucceeds(
      addDoc(collection(db, 'media'), {
        ...validDoc('guest-1'),
        caption: 'מזל טוב!',
        guestName: 'דנה',
        thumbUrl: 'https://example.com/t.jpg',
        thumbPath: 'uploads/thumbs/0b1f4c9e-1c2d-4b8e-9f3a-abcdef012345.jpg',
      }),
    );
  });

  it('denies unauthenticated writes', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(addDoc(collection(db, 'media'), validDoc('nobody')));
  });

  it('denies a forged uid', async () => {
    const db = env.authenticatedContext('guest-1').firestore();
    await assertFails(addDoc(collection(db, 'media'), validDoc('someone-else')));
  });

  it('denies an unknown media type', async () => {
    const db = env.authenticatedContext('guest-1').firestore();
    await assertFails(addDoc(collection(db, 'media'), { ...validDoc('guest-1'), type: 'gif' }));
  });

  it('denies a client-side timestamp', async () => {
    const db = env.authenticatedContext('guest-1').firestore();
    await assertFails(
      addDoc(collection(db, 'media'), { ...validDoc('guest-1'), timestamp: Timestamp.now() }),
    );
  });

  it('denies creating an already-hidden document', async () => {
    const db = env.authenticatedContext('guest-1').firestore();
    await assertFails(addDoc(collection(db, 'media'), { ...validDoc('guest-1'), hidden: true }));
  });

  it('denies a caption over 200 characters', async () => {
    const db = env.authenticatedContext('guest-1').firestore();
    await assertFails(
      addDoc(collection(db, 'media'), { ...validDoc('guest-1'), caption: 'x'.repeat(201) }),
    );
  });

  it('denies extra keys', async () => {
    const db = env.authenticatedContext('guest-1').firestore();
    await assertFails(addDoc(collection(db, 'media'), { ...validDoc('guest-1'), likes: 5 }));
  });

  it('denies a storage path outside uploads/', async () => {
    const db = env.authenticatedContext('guest-1').firestore();
    await assertFails(
      addDoc(collection(db, 'media'), { ...validDoc('guest-1'), storagePath: 'other/abc.jpg' }),
    );
  });
});

describe('media: read', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'media', 'visible'), { ...validDoc('u'), timestamp: Timestamp.now() });
      await setDoc(doc(db, 'media', 'hidden'), {
        ...validDoc('u'),
        timestamp: Timestamp.now(),
        hidden: true,
      });
    });
  });

  it('lets guests list only non-hidden items when they filter for it', async () => {
    const db = env.authenticatedContext('guest-1').firestore();
    const snap = await assertSucceeds(
      getDocs(
        query(collection(db, 'media'), where('hidden', '==', false), orderBy('timestamp', 'desc')),
      ),
    );
    expect(snap.docs.map((d) => d.id)).toEqual(['visible']);
  });

  it('denies a guest list query without the hidden filter', async () => {
    const db = env.authenticatedContext('guest-1').firestore();
    await assertFails(getDocs(query(collection(db, 'media'), orderBy('timestamp', 'desc'))));
  });

  it('denies a guest reading a hidden document directly', async () => {
    const db = env.authenticatedContext('guest-1').firestore();
    await assertFails(getDoc(doc(db, 'media', 'hidden')));
    await assertSucceeds(getDoc(doc(db, 'media', 'visible')));
  });

  it('denies unauthenticated reads', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'media', 'visible')));
  });

  it('lets an admin list everything', async () => {
    const db = env.authenticatedContext('admin-1', { admin: true }).firestore();
    const snap = await assertSucceeds(
      getDocs(query(collection(db, 'media'), orderBy('timestamp', 'desc'))),
    );
    expect(snap.size).toBe(2);
  });
});

describe('media: update / delete', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'media', 'item'), {
        ...validDoc('guest-1'),
        timestamp: Timestamp.now(),
      });
    });
  });

  it('denies guests, even the uploader, from updating or deleting', async () => {
    const db = env.authenticatedContext('guest-1').firestore();
    await assertFails(updateDoc(doc(db, 'media', 'item'), { hidden: true }));
    await assertFails(deleteDoc(doc(db, 'media', 'item')));
  });

  it('allows an admin to hide and delete', async () => {
    const db = env.authenticatedContext('admin-1', { admin: true }).firestore();
    await assertSucceeds(updateDoc(doc(db, 'media', 'item'), { hidden: true }));
    await assertSucceeds(deleteDoc(doc(db, 'media', 'item')));
  });

  it('denies a self-declared admin claim that is not true', async () => {
    const db = env.authenticatedContext('sneaky', { admin: 'true' }).firestore();
    await assertFails(deleteDoc(doc(db, 'media', 'item')));
  });
});

describe('other collections', () => {
  it('are locked down', async () => {
    const db = env.authenticatedContext('admin-1', { admin: true }).firestore();
    await assertFails(setDoc(doc(db, 'settings', 'x'), { a: 1 }));
    await assertFails(getDoc(doc(db, 'settings', 'x')));
  });
});
