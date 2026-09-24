/**
 * Shared helper for the admin scripts: reuses the Firebase CLI login
 * (`npx firebase login`) so no service-account JSON is needed.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);

interface CliAuth {
  getGlobalDefaultAccount():
    { user: { email: string }; tokens: { refresh_token: string } } | undefined;
  getAccessToken(refreshToken: string, scopes: string[]): Promise<{ access_token: string }>;
}

export function projectId(): string {
  const rc = JSON.parse(readFileSync(resolve(process.cwd(), '.firebaserc'), 'utf8')) as {
    projects: { default: string };
  };
  return rc.projects.default;
}

export function storageBucket(): string {
  try {
    const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    const match = /^VITE_FIREBASE_STORAGE_BUCKET=(.+)$/m.exec(env);
    if (match) return match[1].trim();
  } catch {
    // fall through
  }
  return `${projectId()}.firebasestorage.app`;
}

export async function accessToken(): Promise<string> {
  const auth = require('firebase-tools/lib/auth') as CliAuth;
  const account = auth.getGlobalDefaultAccount();
  if (!account) {
    throw new Error('Not logged in to the Firebase CLI. Run: npx firebase login');
  }
  const tokens = await auth.getAccessToken(account.tokens.refresh_token, [
    'https://www.googleapis.com/auth/cloud-platform',
  ]);
  return tokens.access_token;
}

export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(`${response.status} ${body.error?.message ?? JSON.stringify(body)}`);
  }
  return body;
}
