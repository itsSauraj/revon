# revon backend (Firebase)

The backend is Firebase only: **Authentication** (Google, email/password, verified phone) and the
**Realtime Database**, which relays live locations and ride events between riders. No server code yet.

On Android/iOS the app uses **React Native Firebase** (native SDKs, needed for phone verification);
on web it uses the Firebase JS SDK. Both talk to the same project.

## One-time setup

1. In the [Firebase console](https://console.firebase.google.com), open the project (`revon-160802`).
2. **Authentication → Sign-in method**, enable:
   - **Google** (this also creates the *web* OAuth client the app needs).
   - **Email/Password**.
   - **Phone**. Under *Phone numbers for testing*, add a test number and code (e.g.
     `+91 99999 00001` → `123456`) so you can test without real SMS.
   - Anonymous is no longer used; you can disable it.
3. **Authentication → Settings → Authorized domains**: make sure `localhost` is listed (web dev).
4. **Realtime Database**: create it if you haven't (locked mode).
5. **Project settings → General → Your apps**:
   - **Android app** with package **`com.velobits.Revon`** (capital R). Add **SHA-1 and SHA-256**
     fingerprints for every build that should sign in:
     - local debug build (`npm run android:dev`): get both with
       `keytool -list -v -keystore app/android/app/debug.keystore -alias androiddebugkey -storepass android`
       (SHA-1 of the current one: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`)
     - EAS builds: `npx eas-cli@latest credentials -p android`
     Google sign-in and phone verification both fail with "app not authorized" without these.
     Then **download `google-services.json`** and put it in `app/google-services.json`.
   - **iOS app** with bundle ID **`com.velobits.Revon`** → download **`GoogleService-Info.plist`** into
     `app/GoogleService-Info.plist`. (Phone auth on iOS also needs APNs set up in Firebase, or it falls
     back to a reCAPTCHA check.)
   - **Web app** (for the web build): copy its config into `app/.env.local`:

     ```
     EXPO_PUBLIC_FIREBASE_API_KEY=...
     EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
     EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://<db-name>.<region>.firebasedatabase.app
     EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
     EXPO_PUBLIC_FIREBASE_APP_ID=...
     ```

   Both config files are gitignored. For EAS cloud builds, upload them as EAS *file* environment
   variables named `GOOGLE_SERVICES_JSON` and `GOOGLE_SERVICES_PLIST`.
6. Rebuild the native app after adding the files (they're applied at build time):
   `npx expo prebuild --platform android` then `npm run android:dev -- --device <device>`.
7. Deploy the security rules from this folder:

   ```
   npx firebase-tools login
   npx firebase-tools use --add          # pick your project
   npx firebase-tools deploy --only database
   ```

   (Or paste `database.rules.json` into **Realtime Database → Rules** and publish.)

### Phone verification (SMS)

Firebase sends the SMS with its own fixed template (e.g. "123456 is your verification code for
revon"); the text can't be customised. The no-cost Spark plan has a small daily SMS quota; real use
needs the **Blaze** plan (SMS is billed per message, rates vary by country). Use test numbers while
developing.

## Google Maps Platform APIs

Enable these on the same Cloud project: **Maps SDK for Android**, **Maps SDK for iOS**,
**Places API (New)**, **Routes API**.

Places and Routes are called over REST from the app. If you restrict the key to *Android apps* /
*iOS apps*, those REST calls are rejected — for the POC use an unrestricted key or a separate key in
`EXPO_PUBLIC_GOOGLE_API_KEY` restricted by API (Places API (New) + Routes API only).

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

Rules summary: everything requires sign-in; a user reads/writes only their own `users/{uid}`, and
`phone` must equal the verified number in their sign-in token; only members can read a ride's riders, locations and
events; a rider writes only their own member record and location; events are append-only and must be
signed by their author; nobody can join a locked ride (rejoining is allowed).

## Post-POC

- Cloud Functions (Blaze plan) for remote push via FCM, so SOS reaches riders whose app was killed.
- Scheduled cleanup of rides with no activity for 24 h (the app already treats them as ended).
- https invite links (App Links / Universal Links) on a hosted domain.
