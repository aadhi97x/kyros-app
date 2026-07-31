# Kyros — mobile app

The member (parent / adult player) and coach experiences for Kyros, the football club and academy platform. Expo + React Native + TypeScript, expo-router for navigation, React Query for server state.

The API lives in the [`kyros-web`](https://github.com/aadhi97x/kyros-web) repository — run that first.

---

## Quick start

```bash
npm install
```

```bash
cp .env.example .env
```

Set `EXPO_PUBLIC_API_URL` for where your device can reach the API:

| Target | URL |
|---|---|
| iOS simulator | `http://localhost:3000` |
| Android emulator | `http://10.0.2.2:3000` |
| Physical device | `http://<your-lan-ip>:3000` |

```bash
npx expo start
```

Sign in with a seeded account (see the kyros-web seed output). Password: `kyros-dev-2026`.

- **+919800000010** — parent with two children; one has consent on file, one deliberately does not
- **+919800000003** — coach with today's sessions and a full roster

---

## What the app is, architecturally

**The app renders; the server decides.** Spec 2.7 makes the enrollment flow a config-driven state machine — so the enroll screen asks `GET /api/v1/enrollment` "what step is this attempt on?" and renders exactly that step. It never infers the next screen. A club that requires demos, coach placement and approval produces a completely different sequence than a club with none of those, from the same code, with zero client-side branching on club identity.

```
app/
  (auth)/        sign-in, sign-up, OTP verify, parent-vs-player choice
  (member)/
    discover     catalog + filters (spec 2.4)
    club/[id]    club & package detail; the CTA text comes from the club's config
    enroll       THE adaptive flow — renders whatever step the server returns
    consent/[id] per-purpose DPDP consent with identity verification
    demo/[id]    demo slot booking
    memberships  status badges, instalments, family wallet, per-club policies
    chat + thread/[id]
    family       player profiles, consent management, settings
  (coach)/
    today        today's sessions with cached rosters
    session/[id] offline-first attendance + geofenced check-in
src/
  api/           fetch client (auto token refresh), secure token storage, types
  offline/       the attendance queue — see below
  state/         session context
  ui/            theme + shared components
```

## The offline attendance queue

Spec 4.3: attendance must work with no connectivity, because Indian ground conditions demand it. The design assumption in `src/offline/attendance-queue.ts` is that the coach's phone has **no usable connection for the entire session** and gets one on the drive home:

1. Every tap writes to AsyncStorage and returns. Nothing a coach does on the pitch waits on the network.
2. Each mark carries a `clientMutationId` (idempotency key) and `recordedAtDevice` (when the tap happened, not when it synced).
3. `flush()` posts the queue per session; the server's `acknowledgedMutationIds` says exactly which items to drop — **including rejected ones**, so a mark that can never succeed cannot block the queue forever.
4. Re-marking a player replaces the queued entry with a *new* mutation id: a correction is a new mutation, and reusing the old id would let the server dedupe it away as a replay.

The flush runs on app start, on a 60-second timer while the app is open, when the Today screen mounts, and on pull-to-refresh. Flushes are serialised so a manual and an automatic one cannot double-post — though even if they did, the server would dedupe.

## Security notes

- Tokens live in the platform keystore (`expo-secure-store`), not AsyncStorage. The in-memory cache exists because the Android keystore round trip is genuinely slow.
- Refresh tokens rotate on every use; the client deduplicates concurrent refreshes because the server treats reuse of a rotated token as a compromise and kills the whole session family.
- **Nothing secret goes in `EXPO_PUBLIC_*`** — those values are baked into the JS bundle and readable by anyone with the APK. The Razorpay *key id* is publishable; the key secret stays on the server, always.
- `EXPO_PUBLIC_DEV_TOOLS=true` enables OTP auto-fill from the dev-mode API. It must be `false` in any build that ships.

## Scripts

| Command | What it does |
|---|---|
| `npx expo start` | Development server (press `a` / `i` / `w` for a target) |
| `npm run verify` | Typecheck + lint + tests |
| `npx expo prebuild` | Generate native projects (`android/`, `ios/` are git-ignored; regenerate, don't commit) |
