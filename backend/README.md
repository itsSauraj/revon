# revon backend (Firebase)

The POC backend is Firebase only: **Realtime Database** relays live locations and ride events between
riders, and **Anonymous Auth** gives each install an id. No server code yet.

## One-time setup

1. In the [Firebase console](https://console.firebase.google.com), add Firebase to your existing Google
   Cloud project (the one that owns your Maps key).
2. **Build → Authentication → Sign-in method** → enable **Anonymous**.
3. **Build → Realtime Database** → create a database (pick the region closest to your riders), start in
   *locked mode*.
4. **Project settings → General → Your apps** → add a **Web app**. Copy its config into `app/.env.local`:

   ```
   EXPO_PUBLIC_FIREBASE_API_KEY=...
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://<db-name>.<region>.firebasedatabase.app
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
   EXPO_PUBLIC_FIREBASE_APP_ID=...
   ```

   The app uses the Firebase JS SDK, so no `google-services.json` / `GoogleService-Info.plist` is needed.
5. Deploy the security rules from this folder:

   ```
   npx firebase-tools login
   npx firebase-tools use --add          # pick your project
   npx firebase-tools deploy --only database
   ```

   (Or paste `database.rules.json` into **Realtime Database → Rules** and publish.)

## Google Maps Platform APIs

Enable these on the same Cloud project: **Maps SDK for Android**, **Maps SDK for iOS**,
**Places API (New)**, **Routes API**.

Places and Routes are called over REST from the app. If you restrict the key to *Android apps* /
*iOS apps*, those REST calls are rejected — for the POC use an unrestricted key or a separate key in
`EXPO_PUBLIC_GOOGLE_API_KEY` restricted by API (Places API (New) + Routes API only).

## Data model

```
codes/{CODE}                   -> rideId
rides/{rideId}/meta            code, destination, route, avoid, createdAt, createdBy, lastActivityAt, locked
rides/{rideId}/members/{uid}   name, phone?, color, role (lead|sweep), status, joinedAt
rides/{rideId}/locations/{uid} lat, lng, speed, heading, ts, alongM, offRoute
rides/{rideId}/events/{id}     type, uid, ts, data?
rides/{rideId}/regroup         lat, lng, label, setBy, ts
```

Rules summary: everything requires sign-in; only members can read a ride's riders, locations and
events; a rider writes only their own member record and location; events are append-only and must be
signed by their author; nobody can join a locked ride (rejoining is allowed).

## Post-POC

- Cloud Functions (Blaze plan) for remote push via FCM, so SOS reaches riders whose app was killed.
- Scheduled cleanup of rides with no activity for 24 h (the app already treats them as ended).
- https invite links (App Links / Universal Links) on a hosted domain.
