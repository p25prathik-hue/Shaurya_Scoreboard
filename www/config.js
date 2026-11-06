// Shaurya Live — app configuration
// ------------------------------------------------------------------
// Paste your Supabase project's values here (Supabase → Project Settings → API).
// The anon / publishable key is designed to be public: the database's
// Row Level Security rules (supabase/schema.sql) decide what anyone can do.
// NEVER put the service_role / secret key in this file.
//
// While these are left empty, the app runs in DEMO MODE with sample data.
window.SHAURYA_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',

  // Fest days (Asia/Kolkata). Used for the day switcher.
  FEST_DAYS: ['2026-11-20', '2026-11-21', '2026-11-22'],

  // Custom URL scheme used by the Android app to return from Google sign-in.
  // Must match capacitor.config.json / the Android build and be added to
  // Supabase → Authentication → URL Configuration → Redirect URLs as
  //   in.iima.shaurya://auth
  APP_SCHEME: 'in.iima.shaurya',

  // Where the Android APK can be downloaded (shown on the account page).
  APK_URL: 'https://github.com/p25prathik-hue/Shaurya_Scoreboard/releases/download/android-latest/ShauryaLive.apk',
};
