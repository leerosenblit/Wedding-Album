# Wedding Album

A single-page app where wedding guests scan a QR code, upload photos and videos from their phone, and browse everyone's uploads live. Built for one event (ours), not as a multi-tenant product.

- **Stack:** Vite 8, React 19, TypeScript, Firebase (Auth, Firestore, Storage, App Check, Hosting), PWA.
- **Routes:** `/` guests · `/admin` moderation and export · `/qr` printable table card.

## How it works

1. Every visitor gets an **anonymous Firebase session**. Firestore and Storage rules require it.
2. Guests coming from the QR link carry `?code=…` and skip the event-code screen. The code is a **UX gate only**; the real protection is security rules + App Check.
3. Images are **compressed in the browser** (1 MB / 1920 px) and a **400 px thumbnail** is generated client-side. Both are uploaded to `uploads/{uuid}.ext` and `uploads/thumbs/{uuid}.jpg`; the original file name is never used.
4. A Firestore document in `media` is written **last**, so the gallery never shows a broken item. The rules validate every field (see [firestore.rules](firestore.rules)).
5. The gallery loads the first page once, then watches it live; older pages load on scroll.
6. Admins (a user with the `admin` custom claim) can hide, delete and download everything.

## Setup

Prerequisites: Node 22+, Java 21+ (firebase-tools refuses older JDKs for the emulators), a Firebase project.

```bash
npm ci
cp .env.example .env.local   # fill in the values
npx firebase login
```

### Environment variables

| Variable                  | Where to get it                                           |
| ------------------------- | --------------------------------------------------------- |
| `VITE_FIREBASE_*`         | Firebase console → Project settings → Your apps → Web app |
| `VITE_RECAPTCHA_SITE_KEY` | reCAPTCHA Enterprise site key registered in App Check     |
| `VITE_EVENT_CODE`         | Any short code you print on the cards. Empty = no gate.   |
| `VITE_SITE_URL`           | The Hosting URL, used to build the QR link                |
| `VITE_USE_EMULATORS`      | `true` to point the app at local emulators                |

The Firebase web config is public by design, but the API key must be **restricted** (see Security).

### Scripts

| Command                  | What it does                                                        |
| ------------------------ | ------------------------------------------------------------------- |
| `npm run dev`            | Dev server at http://localhost:5173                                 |
| `npm run build`          | Production build to `dist/`                                         |
| `npm run preview`        | Serve `dist/` locally                                               |
| `npm run lint`           | ESLint                                                              |
| `npm run format`         | Prettier (write) · `format:check` in CI                             |
| `npm run typecheck`      | `tsc -b`                                                            |
| `npm test`               | Unit and component tests (Vitest + Testing Library)                 |
| `npm run test:rules`     | Security-rules tests against the emulators                          |
| `npm run emulators`      | Start Auth, Firestore, Storage emulators with the UI                |
| `npm run deploy:rules`   | Deploy `firestore.rules`, `firestore.indexes.json`, `storage.rules` |
| `npm run deploy:hosting` | Build and deploy Hosting                                            |
| `npm run admin:claim`    | Create/grant the admin user (uses your Firebase CLI login)          |
| `npm run export`         | Download every upload to `./export/` (uses your Firebase CLI login) |

The emulator scripts go through `scripts/withJava.mjs`, which finds a JDK 21+ automatically (firebase-tools refuses older ones), so you don't need to change `JAVA_HOME`.

### Local development against the emulators

```bash
npm run emulators
# in another terminal
VITE_USE_EMULATORS=true npm run dev
```

## Firebase console checklist (one time)

Already done for this project (2026-09-24): rules and index deployed, Anonymous and Email/Password sign-in enabled, App Check registered with a reCAPTCHA Enterprise key in monitor mode, Hosting live at https://wedding-album-b0cf7.web.app.

1. **Rules**: `npm run deploy:rules` whenever `firestore.rules`, `storage.rules` or the index file change.
2. **Admin user**: create it and grant the claim in one go (password at least 8 characters):
   ```bash
   npm run admin:claim -- you@example.com --password "choose-a-strong-one"
   ```
   For an existing user, omit `--password`. Sign out and back in on `/admin` afterwards.
3. **App Check enforcement**: Firebase console → App Check → APIs. Once "verified requests" show up for Firestore and Storage, switch both to **Enforce**. For local dev, copy the debug token printed in the browser console into App Check → Apps → Manage debug tokens.
4. **Firestore → Indexes**: confirm the composite index shows "Enabled" before guests arrive.

### Google Cloud console

5. **APIs & Services → Credentials → "Browser key (auto created by Firebase)"**: under Application restrictions choose Websites and add `https://wedding-album-b0cf7.web.app/*`, `https://wedding-album-b0cf7.firebaseapp.com/*`, `http://localhost:5173/*`. The API list is already restricted by Firebase; leave it.
6. **CORS on the bucket** (only needed for the in-browser "download all" on `/admin`):
   ```bash
   gsutil cors set cors.json gs://wedding-album-b0cf7.firebasestorage.app
   ```
   Without it, use `npm run export` instead, which does not need CORS.

### GitHub

Repository **variables**: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_SITE_URL`.
Repository **secrets**: `VITE_EVENT_CODE`, `VITE_RECAPTCHA_SITE_KEY`, and `FIREBASE_SERVICE_ACCOUNT` for the deploy workflow (`npx firebase init hosting:github` generates it).

CI runs lint, format check, typecheck, unit tests, build and the rules tests on every push and PR. Merges to `main` deploy Hosting; PRs get a preview channel.

## Security notes

- **Firestore rules** allow reads for signed-in users (hidden items only for admins), validated creates for signed-in users, and updates/deletes only for admins. Every other collection is denied.
- **Storage rules** allow `uploads/*` (images ≤ 10 MB, videos ≤ 50 MB) and `uploads/thumbs/*` (images ≤ 512 KB) for signed-in users; deletes are admin-only.
- **The event code is not a secret.** It is in the JS bundle. It keeps random visitors from stumbling in, nothing more. If you ever need it enforced, add a Cloud Function that verifies the code and mints a custom token with a `guest` claim, and require that claim in the rules (needs the Blaze plan).
- **The API key was committed in plain text in the first commit** of this repository. Firebase web keys are identifiers, not secrets, but restricting the key (step 5) is what actually matters. Rewriting git history is not worth it once the key is restricted.
- `.env.local` and `export/` are git-ignored.

## Before the wedding

- Deploy rules, indexes and hosting; verify App Check is enforcing.
- Wipe any test data: old documents that lack the `hidden` and `storagePath` fields are invisible to guests and cannot be deleted from the admin UI.
- Print `/qr` (it hides the button when printing).
- Test on a phone in a private window: anonymous sign-in, QR link skips the code screen, upload a few photos and a video, open the lightbox, confirm a second device sees the new upload.

## After the wedding

```bash
npm run export
```

Then consider disabling anonymous sign-in and switching App Check off for the project, or deleting the project entirely.

## Project layout

```
src/
  config/event.ts        couple names, limits, page size (single source of truth)
  lib/                   firebase init, upload pipeline, compression, validation, zip export
  hooks/                 useAuth, useUpload, useMediaFeed, useToast, useLocalStorage
  components/            Uploader, Gallery, MediaCard, Lightbox, EventCodeGate, Toast, ErrorBoundary
  pages/                 GuestPage, AdminPage, QrPage
  router.tsx             react-router with lazy admin/QR chunks
tests/rules/             emulator-backed security-rules tests
scripts/                 setAdminClaim.ts, downloadAll.ts (Firebase CLI login), withJava.mjs
firestore.rules, storage.rules, firestore.indexes.json, firebase.json, cors.json
```
