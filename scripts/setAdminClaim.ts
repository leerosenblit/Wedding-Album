/**
 * Grants (or revokes) the `admin` custom claim used by the security rules and /admin.
 * Uses your Firebase CLI login; no service account needed.
 *
 *   npm run admin:claim -- you@example.com                    # grant to an existing user
 *   npm run admin:claim -- you@example.com --password S3cret  # create the user first, then grant
 *   npm run admin:claim -- you@example.com --revoke           # revoke
 *
 * The user must sign out and back in for the claim to take effect.
 */
import { api, projectId } from './cliAuth';

interface Account {
  localId: string;
  email?: string;
  customAttributes?: string;
}

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith('--'));
const revoke = args.includes('--revoke');
const passwordIndex = args.indexOf('--password');
const password = passwordIndex >= 0 ? args[passwordIndex + 1] : undefined;

if (!email) {
  console.error('Usage: npm run admin:claim -- <email> [--password <pw>] [--revoke]');
  process.exit(1);
}

const base = `https://identitytoolkit.googleapis.com/v1/projects/${projectId()}`;
const claims = revoke ? '{}' : '{"admin":true}';

const lookup = await api<{ users?: Account[] }>(`${base}/accounts:lookup`, {
  method: 'POST',
  body: JSON.stringify({ email: [email] }),
});
let user = lookup.users?.[0];

if (!user) {
  if (!password) {
    console.error(
      `No user with email ${email}. Add --password <pw> to create it, or add the user in the Firebase console.`,
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }
  user = await api<Account>(`${base}/accounts`, {
    method: 'POST',
    body: JSON.stringify({ email, password, emailVerified: true, customAttributes: claims }),
  });
  console.log(`Created ${email} (${user.localId}) with admin access.`);
} else {
  await api(`${base}/accounts:update`, {
    method: 'POST',
    body: JSON.stringify({ localId: user.localId, customAttributes: claims }),
  });
  console.log(`${revoke ? 'Revoked' : 'Granted'} admin for ${email} (${user.localId}).`);
}
console.log('Sign out and sign in again on /admin for it to take effect.');
