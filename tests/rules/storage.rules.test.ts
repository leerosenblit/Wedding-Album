import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';
import { bytes, createEnv, MB } from './helpers';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createEnv();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearStorage();
});

describe('uploads/{file}', () => {
  it('lets a signed-in guest upload an image under 10MB', async () => {
    const storage = env.authenticatedContext('guest-1').storage();
    await assertSucceeds(
      uploadBytes(ref(storage, 'uploads/a.jpg'), bytes(1 * MB), { contentType: 'image/jpeg' }),
    );
  });

  it('lets a signed-in guest upload a video under 50MB', async () => {
    const storage = env.authenticatedContext('guest-1').storage();
    await assertSucceeds(
      uploadBytes(ref(storage, 'uploads/v.mp4'), bytes(2 * MB), { contentType: 'video/mp4' }),
    );
  });

  it('rejects images over 10MB', async () => {
    const storage = env.authenticatedContext('guest-1').storage();
    await assertFails(
      uploadBytes(ref(storage, 'uploads/big.jpg'), bytes(10 * MB + 1), {
        contentType: 'image/jpeg',
      }),
    );
  });

  it('rejects non-media content types', async () => {
    const storage = env.authenticatedContext('guest-1').storage();
    await assertFails(
      uploadBytes(ref(storage, 'uploads/x.txt'), bytes(10), { contentType: 'text/plain' }),
    );
  });

  it('rejects unauthenticated uploads and reads', async () => {
    const storage = env.unauthenticatedContext().storage();
    await assertFails(
      uploadBytes(ref(storage, 'uploads/a.jpg'), bytes(10), { contentType: 'image/jpeg' }),
    );
    await assertFails(getBytes(ref(storage, 'uploads/a.jpg')));
  });

  it('rejects paths outside uploads/', async () => {
    const storage = env.authenticatedContext('guest-1').storage();
    await assertFails(
      uploadBytes(ref(storage, 'private/a.jpg'), bytes(10), { contentType: 'image/jpeg' }),
    );
  });

  it('lets only admins delete', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), 'uploads/a.jpg'), bytes(10), {
        contentType: 'image/jpeg',
      });
    });
    await assertFails(
      deleteObject(ref(env.authenticatedContext('guest-1').storage(), 'uploads/a.jpg')),
    );
    await assertSucceeds(
      deleteObject(
        ref(env.authenticatedContext('admin', { admin: true }).storage(), 'uploads/a.jpg'),
      ),
    );
  });
});

describe('uploads/thumbs/{file}', () => {
  it('accepts small images only', async () => {
    const storage = env.authenticatedContext('guest-1').storage();
    await assertSucceeds(
      uploadBytes(ref(storage, 'uploads/thumbs/a.jpg'), bytes(100 * 1024), {
        contentType: 'image/jpeg',
      }),
    );
    await assertFails(
      uploadBytes(ref(storage, 'uploads/thumbs/big.jpg'), bytes(512 * 1024 + 1), {
        contentType: 'image/jpeg',
      }),
    );
    await assertFails(
      uploadBytes(ref(storage, 'uploads/thumbs/v.mp4'), bytes(10), { contentType: 'video/mp4' }),
    );
  });
});
