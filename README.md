# revon

**Ride together.** revon is a mobile app for group motorcycle rides. Everyone in the group shares
one live map, so riders can see who is ahead, who has stopped and who needs help, without pulling
over to check a chat app or call around.

> **Status:** proof of concept. Android and iOS, built with Expo / React Native.

## Features

**Map**
- Full-screen map with place search and long-press to drop a pin, on **Google Maps** or **OpenStreetMap**
  (MapLibre, Photon, Valhalla), chosen in Settings
- Route preview with distance and time, with options to avoid highways and tolls
- Two-wheeler routing where Google supports it, otherwise driving
- **In-app ride view**: next-turn card (turn arrow, live distance to the turn, street), time/distance left and
  arrival time, From → To card, heading-up or north-up camera, zoom controls, ridden part greyed out,
  automatic re-route when you leave the route

**Accounts and onboarding**
- Animated welcome intro (convoy, live pins, SOS, navigation)
- Sign in with **Google** or **email/password** (strict validation, live password rules, email verification, password reset)
- Mobile number with **country code picker**, validated per country, verified by **SMS OTP** (Firebase Phone Auth)

**Group rides**
- Start a ride to a destination and invite riders with a 6-character code or a `revon://join/CODE` link
- No host: anyone in the ride can invite others; any member can lock the ride to new joiners
- Live marker for every rider with name tag and color; greyed out (kept at the last position) after 60 s without signal
- Status labels on the map (Fuel stop, Rest stop, Food stop, Mechanical, Needs help) together with a notification; tapping the notification jumps to that rider
- Rider list ordered front to back, showing how far each rider is ahead of or behind you along the route
- Tap a rider for speed, moving or stopped, road ETA, a Call button (if they chose to share their number) and an in-app route to them

**Biker extras**
- One-tap status: Fuel, Rest, Food, Mechanical
- Lead and Sweep roles, with an alert when the group spreads out more than 2 km
- Regroup pin anyone can drop, visible to the whole group

**Safety and alerts**
- **SOS**: hold for 2 s to alert everyone; your marker turns red and riders get a "Ride to them" button
- Off-route alert when a rider is more than 150 m from the group route for over 20 s
- Arrival notice when a rider reaches the destination
- Alerts are spoken aloud and shown as banners, plus notifications when the app is in the background
- Location keeps sharing while Google Maps is open in front (Android foreground service, iOS background location)

## Repository layout

```
.
├── app/              Expo (React Native) mobile app
│   ├── src/app/      Screens (Expo Router, file-based routes)
│   ├── src/components/
│   ├── src/hooks/
│   └── src/lib/      Auth, database, rides, Google APIs, validation, geo math, location task, alerts
├── backend/          Firebase setup guide, database security rules, admin scripts
├── docs/             Product proposal
└── product_assets/   Brand icons (Android, iOS, web)
```

## Tech stack

| Area | Choice |
|---|---|
| App | Expo SDK 57, React Native 0.86, TypeScript, Expo Router |
| Map | `react-native-maps` with the Google provider on both platforms |
| Places and routing | Google Places API (New), Routes API (REST) |
| Location | `expo-location` + `expo-task-manager` background task |
| Alerts | `expo-notifications`, `expo-speech` |
| UI | Monochrome theme with one accent (`#C8F135`); icons from [react-icons](https://react-icons.github.io/react-icons/) (Lucide set), drawn with `react-native-svg` on mobile |
| Backend | Firebase Auth (Google, email/password, phone) + Realtime Database: React Native Firebase on Android/iOS, Firebase JS SDK on web |

## Getting started

Setup is split into two guides:

| Guide | Covers |
|---|---|
| [backend/README.md](backend/README.md) | Everything in the **Firebase console**: sign-in providers, SMS region policy, test phone numbers, Realtime Database, registering the Android/iOS/web apps (package name, SHA fingerprints, config files), Play Integrity, deploying the security rules, admin scripts |
| [app/README.md](app/README.md) | Your **machine** and the **app**: requirements (Node, Android Studio, JDK 17), `.env.local`, Firebase config files, Google Maps Platform APIs and keys, running on a phone over USB / Wi-Fi / web / EAS, when to rebuild, scripts, troubleshooting |

### Quick start

1. Set up the Firebase project: [backend/README.md](backend/README.md).
2. Install and configure the app:
   ```bash
   cd app
   npm install
   cp .env.example .env.local      # fill in the keys (see app/README.md)
   # add app/google-services.json (and GoogleService-Info.plist for iOS)
   ```
3. Build and run on an Android phone connected by USB:
   ```bash
   npx expo prebuild --platform android
   npm run android:dev -- --device <device>   # first time / after native changes
   npm run start:usb                          # every day
   ```

Expo Go isn't supported: revon needs its own development build (native Firebase, Google Sign-In,
maps, background location).

## Testing a group ride

You need two devices, or one device and an emulator with mock locations.

Each device needs its own revon account (Firebase test phone numbers make this quick).

1. Device A: search for a destination, tap **Start Group Ride**, and share the invite.
2. Device B: open the link, or use **Join a ride** and enter the code.
3. Move one device (or play a GPX route in the emulator) and watch its marker on the other.
4. Leave the route, reach the destination, or hold **SOS** to check each alert.
5. Tap **Navigate** to open the in-app ride view, or open Google Maps from the directions list, and
   confirm the other device still gets updates.

## Known limitations (POC)

- Alerts reach riders whose app is running (foreground or tracking in the background). Push to
  fully closed apps needs Cloud Functions + FCM (planned).
- Invite links use the `revon://` scheme; https links that install-then-join need a hosted domain.
- Calling uses the phone dialer; there is no in-app voice.
- **Release blocker:** the live next-turn card is built from Routes API data. Google's Maps Platform
  Terms (§3.2.3(d)(iv)) don't allow real-time navigation built that way; replace it with the Google
  Navigation SDK before a store release. There are no spoken prompts; the directions list offers a
  hand-off to Google Maps for voice guidance.
- Liquid glass is native on iOS 26+; Android shows translucent panels (no blur over the native map) and
  web uses a CSS backdrop blur.
- The phone verification SMS uses Firebase's fixed template; its text can't be customised.

## Roadmap

- Push notifications via Cloud Functions + FCM (SOS reaches every rider, even with the app closed)
- https invite links (Android App Links / iOS Universal Links)
- Ride history
- Spoken in-app turn-by-turn via the Google Navigation SDK, and group push-to-talk
- Store release: background location declarations, per-platform restricted API keys

## License

Not yet decided. All rights reserved until a license is added.
