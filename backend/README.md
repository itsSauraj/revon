# revon backend (Firebase)

The backend is Firebase only, with no server code yet:

- **Authentication**: Google, email/password (with email verification) and a verified phone number
  (SMS OTP) linked to each account.
- **Realtime Database**: user profiles, plus live locations and events for group rides.

The mobile app uses **React Native Firebase** (native SDKs; phone verification needs them). The web
build uses the **Firebase JS SDK**. Both talk to the same Firebase project.

This folder holds the database security rules, the Firebase CLI config and admin scripts.

```
backend/
├── database.rules.json            Realtime Database security rules
├── firebase.json                  Firebase CLI config (points at the rules)
├── .firebaserc                    Project alias: development -> revon-160802
├── package.json                   Admin scripts (firebase-admin)
└── scripts/
    └── delete-anonymous-users.js  Removes old anonymous test accounts
```

---

## Firebase console setup

Do these once per Firebase project, in the [Firebase console](https://console.firebase.google.com).
The current project is **`revon-160802`**. If you use your own, change `backend/.firebaserc` and the
app's config to match.

### 1. Billing plan

- **Spark (free)** works for development with **test phone numbers** (step 4).
- **Blaze (pay as you go)** is needed to send real SMS beyond a small quota. Firebase bills SMS per
  message, and the rate depends on the country.

The plan is shown in the bottom-left of the console.

### 2. Authentication: sign-in methods

**Build → Authentication → Sign-in method**, enable:

| Provider | Notes |
|---|---|
| **Google** | Set a support email. Enabling it creates the **web OAuth client** the app needs for Google Sign-In. |
| **Email/Password** | Leave *Email link (passwordless)* off. |
| **Phone** | Used to verify the rider's mobile number. |
| ~~Anonymous~~ | **Disable** it. Old builds used it; the current app doesn't. |

### 3. Authentication: settings

**Build → Authentication → Settings**:

- **SMS region policy**. Firebase blocks SMS to every country until you allow it. Choose **Allow** and
  add every country your riders use (at least **India**). Without this, sending a code fails with
  *"SMS unable to be sent until this region enabled by the app developer"*.
- **Authorized domains**. Make sure **`localhost`** is listed for the web build in development. Add
  your real web domain later.
- **User actions** (optional). The default *email enumeration protection* is fine; the app already
  shows the same message whether or not an account exists when you reset a password.

### 4. Test phone numbers (development)

**Sign-in method → Phone → Phone numbers for testing**. Add for example:

| Phone number | Code |
|---|---|
| `+91 99999 00001` | `123456` |

Test numbers never send a real SMS, need no billing and ignore the region policy. In the app, enter
the number and type the code. To also skip the reCAPTCHA / Play Integrity check, set
`EXPO_PUBLIC_PHONE_TEST_MODE=1` in `app/.env.local` (development builds only; see
[app/README.md](../app/README.md#environment-variables)).

### 5. Realtime Database

**Build → Realtime Database → Create database**:

- Pick the location closest to your riders. The current project uses `asia-southeast1`.
- Start in **locked mode**; step 8 deploys the real rules.
- Copy the database URL (`https://<name>.<region>.firebasedatabase.app`) into
  `EXPO_PUBLIC_FIREBASE_DATABASE_URL` in `app/.env.local`.

### 6. Register the apps and download the config files

**Project settings (gear) → General → Your apps**:

#### Android app

- **Package name:** `com.velobits.Revon`. It's case-sensitive, with a capital **R**.
- **SHA certificate fingerprints:** add **both SHA-1 and SHA-256** for every build that should sign in.
  Without them, Google Sign-In and phone verification fail with *"app not authorized"* or
  *DEVELOPER_ERROR*.

  | Build | SHA-1 | SHA-256 |
  |---|---|---|
  | Local debug builds (`npm run android:dev`): Expo's template debug key, the same on every machine | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` | `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C` |
  | EAS builds | from `npx eas-cli@latest credentials -p android` | same command |
  | Google Play (release) | Play Console → *App integrity* → *App signing key* | same page |

  To check a keystore yourself:
  `keytool -list -v -keystore app/android/app/debug.keystore -alias androiddebugkey -storepass android`
- **Download `google-services.json`** and save it as **`app/google-services.json`**. Download it again
  whenever you add fingerprints or enable a sign-in provider: the file contains the OAuth clients, and
  the app reads the Google web client ID from it.

#### iOS app

- **Bundle ID:** `com.velobits.Revon`.
- **Download `GoogleService-Info.plist`** and save it as **`app/GoogleService-Info.plist`**.
- Phone auth on iOS: upload an **APNs auth key** under **Project settings → Cloud Messaging → Apple app
  configuration**. Without it, iOS falls back to a reCAPTCHA page.

#### Web app

Copy its config (`firebaseConfig`) into `app/.env.local`:

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://<name>.<region>.firebasedatabase.app
EXPO_PUBLIC_FIREBASE_PROJECT_ID=<project-id>
EXPO_PUBLIC_FIREBASE_APP_ID=1:...:web:...
```

`google-services.json`, `GoogleService-Info.plist` and `.env.local` are all **gitignored**. For EAS
cloud builds, upload the two config files as EAS **file** environment variables named
`GOOGLE_SERVICES_JSON` and `GOOGLE_SERVICES_PLIST` (EAS dashboard → Project → Environment variables).

### 7. Google Cloud: silent phone verification on Android (recommended)

The Firebase project is also a Google Cloud project. In the
[Google Cloud console](https://console.cloud.google.com) for the same project:

- **APIs & Services → Library → Play Integrity API → Enable.** With this and the SHA-256 from step 6,
  Android verifies the app in the background instead of showing a reCAPTCHA page. Builds not
  installed from Google Play may still show reCAPTCHA sometimes.

The Maps APIs and keys are set up separately; see
[app/README.md](../app/README.md#google-maps-platform).

### 8. Deploy the security rules

From this folder:

```bash
cd backend
npx firebase-tools login
npx firebase-tools use development     # alias from .firebaserc (or: use --add to pick another project)
npx firebase-tools deploy --only database
```

Or paste `database.rules.json` into **Realtime Database → Rules** and click **Publish**. Deploy again
every time `database.rules.json` changes.

### 9. Rebuild the app

The native config files are applied when the app is built, so after adding or re-downloading them:

```bash
cd app
npx expo prebuild --platform android
npm run android:dev -- --device <device>
```

Then restart the dev server (`npm run start:usb`). See [app/README.md](../app/README.md).

---

## Data model

```
users/{uid}                    name, phone (verified, E.164), phoneVerified, sharePhone, email, updatedAt
codes/{CODE}                   -> rideId
rides/{rideId}/meta            code, destination, route, avoid, createdAt, createdBy, lastActivityAt, locked
rides/{rideId}/members/{uid}   name, phone?, color, role (lead|sweep), status, joinedAt
rides/{rideId}/locations/{uid} lat, lng, speed, heading, ts, alongM, offRoute
rides/{rideId}/events/{id}     type, uid, ts, data?
rides/{rideId}/regroup         lat, lng, label, setBy, ts
```

### Rules summary

- Everything requires a signed-in user.
- A user reads and writes only their own `users/{uid}`. `phone` must equal the **verified number in
  their sign-in token**, so an unverified number can't be stored.
- Only members of a ride can read its riders, locations and events.
- A rider writes only their own member record and location.
- Events are append-only and must be signed by their author.
- Nobody can join a locked ride (rejoining is allowed).

---

## Admin scripts

These need an **admin service-account key**:

1. **Project settings → Service accounts → Generate new private key.** The file starts with
   `"type": "service_account"`. The OAuth `client_secret…json` files won't work.
2. Save it as **`backend/service-account.json`**. It's gitignored, and it grants full admin access:
   don't share it, and delete it when you no longer need it.

```bash
cd backend
npm install
npm run users:anonymous          # dry run: lists anonymous test accounts, deletes nothing
npm run users:anonymous:delete   # deletes them (can't be undone)
```

The delete script removes only accounts with no sign-in method, email or phone. Google, email and
phone accounts are never touched. Data those accounts created (old test rides under `rides/` and
`codes/`) stays in the database.

---

## Troubleshooting

| Error in the app | Fix |
|---|---|
| *SMS verification isn't enabled for this country yet* | Step 3: allow the country in **SMS region policy**. |
| *This app build is not authorized with Firebase* / Google `DEVELOPER_ERROR` | Step 6: add the build's **SHA-1 and SHA-256**, re-download `google-services.json`, rebuild. |
| A reCAPTCHA page opens on Android | Step 7: enable **Play Integrity API** and add the SHA-256. For development, use a test number with `EXPO_PUBLIC_PHONE_TEST_MODE=1`. |
| *SMS limit reached for now* | Spark plan quota. Use test numbers, or move to **Blaze**. |
| *This sign-in method is turned off in Firebase* | Step 2: enable the provider. |
| *Firebase is not configured* | `app/google-services.json` is missing (mobile) or the `EXPO_PUBLIC_FIREBASE_*` values are empty (web). |
| Profile not saved / *permission denied* | Step 8: deploy the latest `database.rules.json`. |

## Post-POC

- Cloud Functions (Blaze) for push notifications via FCM, so SOS reaches riders whose app is closed.
- Scheduled cleanup of rides with no activity for 24 h (the app already treats them as ended).
- https invite links (App Links / Universal Links) on a hosted domain.
