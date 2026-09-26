# FLEXY

**FLEXY** is a fast, cinematic media center for movies, series, anime and live TV. It is compatible with **every Stremio addon**. You can install any addon by its URL and FLEXY uses it for catalogs, metadata, streams and subtitles, as Stremio does. It also plays **IPTV M3U playlists**.

> **فلكسي** تطبيق لمشاهدة الأفلام والمسلسلات والأنمي والقنوات المباشرة، متوافق مع **جميع إضافات Stremio**. الصق رابط أي إضافة وسيعمل مباشرة: القوائم، البيانات، روابط المشاهدة والترجمات، بالإضافة إلى قوائم IPTV ‏(M3U).

---

## ✨ Features / المميزات

| | |
|---|---|
| 🧩 **Stremio addons** | Install any addon by URL (`https://…/manifest.json` or `stremio://…`). Supports catalogs (with genre, search and paging), meta, streams, subtitles and addon catalogs. Honours `types` / `idPrefixes`. You can reorder addons, open their configure page, remove them, and browse the official and community addon lists. |
| 🎬 **Player** | hls.js (HLS/m3u8), mpegts.js (IPTV `.ts` / FLV live) and the native `<video>` element, with **automatic fallback** between engines. The engines load only when needed. Quality and audio-track selection, speed, fit/zoom/stretch, picture-in-picture, fullscreen with landscape lock, and a screen lock. |
| ⚡ **Player UX** | Resume where you left off, double-tap to seek, keyboard shortcuts, lock-screen media controls, keep-screen-awake, **auto next episode** (picks the same `bingeGroup` stream, as Stremio does), and a "next episode" countdown. |
| 💬 **Subtitles** | From every subtitle addon plus the ones embedded in streams. SRT/VTT, Arabic CP-1256 auto-detection, a sync (delay) control, size and background settings, and auto-select of your preferred language. |
| ⚽ **Football** | Live scores for the day across 300+ competitions (Champions League, Premier League, LALIGA, Saudi Pro League…), refreshed every 30 s during live matches. There's a 7-day date strip, top-league / live / all filters, and match details (goals, cards, substitutions, stats, venue, TV channels) with a "Watch" button that searches your IPTV channels. Data comes from ESPN's public API. |
| 📺 **Live TV** | Add M3U playlists; channels are grouped with search. Addon `tv` catalogs are listed too. |
| ❤️ **Library** | Favorites, continue watching, per-episode watched marks, and backup export/import. |
| 🌍 **Arabic RTL + English** | Full right-to-left layout, switchable in Settings. |
| 📱 **Everywhere** | Installable PWA, **Android app and Android TV** via Capacitor, and a responsive desktop layout. |

## 🚀 Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

## 📱 Android APK

Every push runs **GitHub Actions → "Build Android APK"**. Download `FLEXY-apk` from the run's artifacts and install it on your phone or Android TV.

All builds are signed with the same key (`android/app/flexy.keystore`), so a new APK always installs over the previous one. If Android says **"App not installed"**, uninstall any older FLEXY build first (older test builds were signed with a different key). For the Play Store, create a private upload key and keep it out of the repository.

Local build (requires Android Studio / Android SDK + JDK 21):

```bash
npm run android:sync   # build web app + copy into android/
npm run android:open   # open in Android Studio (Run ▶)
npm run android:apk    # or build android/app/build/outputs/apk/release/app-release.apk
```

In the Android app, addon and playlist requests go through the native HTTP stack, so addons without CORS headers work. Plain `http://` IPTV links are allowed.

## 🧲 Torrent streams (Torrentio, etc.)

Browsers cannot play torrents directly. Either:

- use an addon that returns direct links (for example Torrentio configured with a Debrid service), **or**
- run a Stremio streaming server and set its URL in **Settings → Streaming server** (for example `http://127.0.0.1:11470`).

Streams the WebView cannot decode (some MKV/HEVC files) can be opened in **VLC / MX Player** with the ↗ button in the stream list or the player.

## 🗂 Project structure

```
src/
  lib/stremio.ts     Stremio addon protocol client (manifest, catalog, meta, stream, subtitles)
  lib/streams.ts     quality grouping, tags, playable URL resolution (direct / torrent / YouTube)
  lib/subtitles.ts   SRT/VTT parser, encoding detection
  lib/m3u.ts         IPTV playlist parser
  lib/native.ts      Capacitor bridge (native HTTP, orientation, status bar, back button)
  player/            engine.ts (hls.js / mpegts.js / native + fallback), Player.tsx, SeekBar.tsx
  pages/             Home, Browse, Catalog, Detail, Search, Favorites, Channels, Addons, Settings
  components/        Shell (top bar, bottom nav, drawer), Hero, cards, rows, stream sheet
  store/             zustand stores (addons, library, settings, playlists, playback)
android/             Capacitor Android project (app id com.flexy.app)
```

## ⚖️ Note

FLEXY does not host or provide any content. Everything comes from the addons and playlists you install yourself. Only use sources you have the right to access.
