# Shaurya'26 Live

Live scores, standings, a what-if qualification calculator, venues and team pages for **Shaurya'26**, IIM Ahmedabad's inter-college sports fest (20–22 Nov 2026). It also includes organiser tools that SportsComm uses to run the fest.

| | |
|---|---|
| **Website** (Windows, Mac, Android, iPhone; can be installed to the home screen) | https://p25prathik-hue.github.io/Shaurya_Scoreboard/ |
| **Android app (APK)** | [ShauryaLive.apk](https://github.com/p25prathik-hue/Shaurya_Scoreboard/releases/download/android-latest/ShauryaLive.apk). It is rebuilt automatically on every push. |
| **Backend** | Supabase: login, Postgres database, realtime score updates |

Until Supabase is connected (step 2 below), the app runs in **demo mode** with sample data, so you can click through everything straight away.

---

## What's inside

**For fans** (no login needed to watch):
- **Home:** live matches, the day's schedule and results, a sport filter, a "My teams" filter and announcements.
- **Match centre:** scoreboard, quarter/set/innings breakdown, timeline, squads, the venue with directions, and a stream link (Phase 2).
- **Standings:** group tables showing Through / In race / Out for each team.
- **What-if calculator:** pick winners and margins for the games left. The app checks every possible outcome and tells you what your team needs. Tie-breaks are by score difference.
- **Knockouts and medal tally:** gold/silver from finals, bronze from 3rd-place matches, and positions from ranking events.
- **Venues & courts:** what's live or next on each court, with Google Maps directions.
- **Teams:** follow a team, see its record, fixtures and squad.

**For organisers** (sign in with an email SportsComm has added):
- **Scorers** score only the sports they are assigned. The scoring pad has a layout for each scoring type:
  - **Points / goals** (basketball, kabaddi, football…): +1/+2/+3 buttons and quarter/half control.
  - **Sets / rubbers / maps** (volleyball, badminton, TT, FIFA, Valorant…).
  - **Cricket:** runs, wides, no-balls, byes, wickets, overs, target.
  - **Ranking events** (athletics, swimming, powerlifting): positions and marks.
  - Every update is logged to a timeline, with **Undo**, a manual result override (walkovers, penalties) and Reopen.
- **Admins** manage:
  - fixtures, including bulk CSV import
  - colleges and teams, imported from the registration export as CSV
  - squads
  - venues and courts with map pins
  - staff roles
  - points and qualifier rules for each sport
  - announcements shown on everyone's home screen

### Shaurya 2026 rulebook built in
Every sport's rules from the 2026 rulebook live in [`www/js/sports-config.js`](www/js/sports-config.js). The database seed in `schema.sql` is generated from that same file by `node scripts/make_seed.mjs`. The rules cover:
- **Formats and squad sizes for each category.** Fans see them on every match page and on **Standings → Rules**. Rosters warn when a squad is outside the limits.
- **Draws and tie-breaks:**
  - Football and futsal never end level: penalties in groups; extra time then penalties in futsal and in football knockouts.
  - Hockey knockouts go to a shootout.
  - Basketball plays overtime; kho-kho plays a super inning; frisbee plays a golden point.
  - Cricket and box cricket go to a Super Over.
  - The scoring pad won't publish an illegal draw.
- **Team ties:**
  - Badminton: 5 matches (men) / 3 (women).
  - TT, tennis, squash, carrom, snooker and FIFA each show their singles/doubles order.
  - Badminton, squash, carrom and snooker play every match even after the tie is decided.
- **Best-of rules:** volleyball men's final is best of 5. Cricket is 15 overs; box cricket is 8 overs.
- **Chess standings:** match points (2/1/0), then total game points.
- **Ranking events:** one click creates every athletics, swimming and powerlifting event from the rulebook (Organise → Fixtures).
- **Grace period:** after 15 minutes a late match raises an alert, and the scoring pad can award a walkover.

To change a rule, edit it in the app under **Organise → Sports settings → Rulebook settings**, or edit `sports-config.js` and re-run the seed script.

---

## Setup (one time, about 20 minutes)

### 1. Create the database
1. Open your Supabase project, then **SQL Editor → New query**.
2. Paste in all of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. This creates the tables, security rules, scoring functions, realtime and the 23 sports with their 2026 rulebook settings. Re-running it later is safe: it updates the sports to the latest rulebook settings without touching teams, fixtures or scores.
3. *Optional:* also run [`supabase/seed_demo.sql`](supabase/seed_demo.sql) to load sample colleges and matches for testing. The file ends with DELETE lines that remove it all again before the fest.

### 2. Connect the app
1. In Supabase, go to **Project Settings → API** and copy the **Project URL** and the **anon / publishable key**.
2. Paste both into [`www/config.js`](www/config.js) and commit. The website and the APK rebuild automatically.

> The anon key is meant to be public: the database's Row Level Security rules decide what each person can do. **Never** put the `service_role` / secret key in the app.

### 3. Allow the sign-in redirects
In Supabase, go to **Authentication → URL Configuration**:
- **Site URL:** `https://p25prathik-hue.github.io/Shaurya_Scoreboard/`
- **Redirect URLs:** add `https://p25prathik-hue.github.io/Shaurya_Scoreboard/` and `in.iima.shaurya://auth` (used by the Android app).

### 4. Turn on Google sign-in
1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services**.
2. **OAuth consent screen:** choose External, enter the app name "Shaurya Live" and a support email, then **Publish app** (move it to *In production*). The app only asks for name and email, so Google doesn't need to review it.
3. Go to **Credentials → Create credentials → OAuth client ID → Web application**.
   - **Authorised redirect URI:** `https://<your-project-ref>.supabase.co/auth/v1/callback`. Supabase shows the exact URL on its Google provider page.
4. Copy the Client ID and Client secret into Supabase under **Authentication → Sign In / Providers → Google**, and enable it.

### 5. Email sign-in codes (for people without Google)
1. In Supabase, go to **Authentication → Emails**.
2. In both the **Magic Link** and **Confirm signup** templates, add this line:
   ```
   Your Shaurya Live code: {{ .Token }}
   ```
   Users type this code into the app. Codes work in the Android app too, where links in emails would open the browser instead.
3. Supabase's built-in email sender only allows a handful of emails per hour. Before the fest, add a free SMTP provider (e.g. Brevo or Resend) under **Authentication → Emails → SMTP Settings**.

### 6. Make yourself admin
1. Sign in once on the website.
2. In the SQL Editor, run:
   ```sql
   update public.profiles set role = 'admin' where lower(email) = lower('you@gmail.com');
   ```
3. Add everyone else from the app under **Organise → Staff & roles**. Enter their email and role (scorer or admin), and the sports a scorer handles. This works even before they've signed in for the first time.

### 7. Website hosting
The **Deploy website** GitHub Action publishes the `www/` folder to GitHub Pages on every push.

If the first run fails with a Pages error, go to **Settings → Pages → Build and deployment → Source: GitHub Actions** and re-run the workflow.

*Vercel instead:* import the repo, set Framework "Other", Root directory `www` and no build command. Then use the Vercel URL in steps 3 and 4.

---

## Android app
- The **Android APK** GitHub Action wraps the same web app with Capacitor and publishes `ShauryaLive.apk` to the [android-latest release](https://github.com/p25prathik-hue/Shaurya_Scoreboard/releases/tag/android-latest).
- **To install:** open the APK link on the phone, then allow "install unknown apps" for the browser when asked.
- Google sign-in in the app opens a secure browser tab and returns to the app through `in.iima.shaurya://auth`.
- **Smooth updates (recommended):** without a signing key, each build gets a new debug key, so people must uninstall the old version before installing a new one. Fix this once:
  ```bash
  keytool -genkeypair -v -keystore shaurya.keystore -alias shaurya -keyalg RSA -keysize 2048 -validity 10000
  base64 -w0 shaurya.keystore > shaurya.keystore.b64
  ```
  Then add two repository secrets under **Settings → Secrets and variables → Actions**:
  - `ANDROID_KEYSTORE_BASE64`: the contents of `shaurya.keystore.b64`
  - `ANDROID_KEYSTORE_PASSWORD`: the password you chose

  Keep `shaurya.keystore` safe and **never commit it**.

**iPhone users** use the website: **Share → Add to Home Screen** installs it like an app. A native iOS build would need a Mac and an Apple developer account.

---

## Security model
- **Anyone** can read fest data (scores, fixtures, teams, venues). Nobody can write without signing in.
- **Fans** can only follow or unfollow teams and change their own display name. Changing their own role is blocked in the database.
- **Scorers** change scores only through the `record_score` / `undo_last_event` database functions. These check that the scorer is assigned to that sport (or to that match). Scorers cannot edit fixtures, teams, or other sports. They can edit squads for their own sports.
- **Admins** (SportsComm) control everything, including roles via `set_staff`.
- Sign-in is handled by Supabase Auth: Google OAuth, or a one-time email code. No passwords are stored by the app.
- These rules were tested against Postgres for every role: guest, fan, scorer (own sport vs other sport), admin.

## Free-tier notes
- Supabase's free plan allows about **200 phones receiving live updates at once**.
- The app releases its live connection when it's in the background for 30 s, and reconnects when reopened. If the live connection fails it falls back to checking for changes every 20 s.
- Free Supabase projects pause after a week of inactivity, so open the dashboard in the days before the fest.

## Project layout
```
www/                 the app (plain HTML/CSS/JS, no build step)
  config.js          Supabase URL + anon key, fest days
  js/store.js        data layer: Supabase backend + demo backend, realtime
  js/scoring.js      scoring rules, standings, what-if engine, medal tally
  js/views-fan.js    fan screens
  js/views-org.js    organiser screens
supabase/schema.sql  database, security rules, functions (run once)
supabase/seed_demo.sql  optional sample data
capacitor.config.json, scripts/patch_android.py, resources/   Android packaging
.github/workflows/   website deploy + APK build
```

**Run locally:** `python3 -m http.server -d www 8080`, then open http://localhost:8080
