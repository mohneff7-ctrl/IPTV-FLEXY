package com.flexy.app;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Full-screen native player (Media3 / ExoPlayer).
 *
 * Hardware decoding, HLS / DASH / MP4 / MKV / WebM / TS, request headers,
 * side-loaded subtitles and forced highest quality. It returns the last
 * position so the web app can save progress and chain the next episode.
 */
@UnstableApi
public class PlayerActivity extends AppCompatActivity {

    public static final String EXTRA_URL = "url";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_SUBTITLE = "subtitle";
    public static final String EXTRA_HEADERS = "headers";
    public static final String EXTRA_SUBS = "subs";
    public static final String EXTRA_START_MS = "startMs";
    public static final String EXTRA_HIGHEST = "highest";
    public static final String EXTRA_SUB_LANG = "subLang";

    public static final String RESULT_POSITION = "position";
    public static final String RESULT_DURATION = "duration";
    public static final String RESULT_ENDED = "ended";
    public static final String RESULT_ERROR = "error";

    private static final int[] RESIZE_MODES = {
        AspectRatioFrameLayout.RESIZE_MODE_FIT,
        AspectRatioFrameLayout.RESIZE_MODE_ZOOM,
        AspectRatioFrameLayout.RESIZE_MODE_FILL,
    };
    private static final String[] RESIZE_LABELS = {"ملاءمة", "تكبير", "تمديد"};

    private ExoPlayer player;
    private PlayerView playerView;
    private boolean ended = false;
    private boolean finished = false;
    private String error = null;
    private int resizeIndex = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemBars();

        Intent in = getIntent();
        String url = in.getStringExtra(EXTRA_URL);
        if (url == null || url.isEmpty()) {
            error = "NO_URL";
            finishWithResult();
            return;
        }

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        playerView = new PlayerView(this);
        playerView.setKeepScreenOn(true);
        playerView.setShowSubtitleButton(true);
        playerView.setShowNextButton(false);
        playerView.setShowPreviousButton(false);
        playerView.setShowFastForwardButton(true);
        playerView.setShowRewindButton(true);
        playerView.setControllerShowTimeoutMs(3500);
        playerView.setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS);
        root.addView(playerView, new FrameLayout.LayoutParams(-1, -1));

        // Top bar: title + episode line on the start side, fit/zoom toggle on the other.
        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(dp(20), dp(34), dp(20), dp(28));
        top.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[] {0xCC000000, 0x00000000}));

        LinearLayout titles = new LinearLayout(this);
        titles.setOrientation(LinearLayout.VERTICAL);
        TextView title = new TextView(this);
        title.setText(in.getStringExtra(EXTRA_TITLE));
        title.setTextColor(Color.WHITE);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        title.setSingleLine(true);
        titles.addView(title);
        String sub = in.getStringExtra(EXTRA_SUBTITLE);
        if (sub != null && !sub.isEmpty()) {
            TextView subtitle = new TextView(this);
            subtitle.setText(sub);
            subtitle.setTextColor(0xCCFFFFFF);
            subtitle.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
            subtitle.setSingleLine(true);
            titles.addView(subtitle);
        }
        top.addView(titles, new LinearLayout.LayoutParams(0, -2, 1f));

        TextView fit = new TextView(this);
        fit.setText(RESIZE_LABELS[0]);
        fit.setTextColor(Color.WHITE);
        fit.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        fit.setPadding(dp(14), dp(8), dp(14), dp(8));
        GradientDrawable pill = new GradientDrawable();
        pill.setCornerRadius(dp(18));
        pill.setColor(0x66000000);
        pill.setStroke(dp(1), 0x55FFFFFF);
        fit.setBackground(pill);
        fit.setOnClickListener(v -> {
            resizeIndex = (resizeIndex + 1) % RESIZE_MODES.length;
            playerView.setResizeMode(RESIZE_MODES[resizeIndex]);
            fit.setText(RESIZE_LABELS[resizeIndex]);
        });
        top.addView(fit);
        root.addView(top, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));

        // Brand watermark: small grey FLEXY, top-left, 50% opacity, always on screen.
        TextView watermark = new TextView(this);
        watermark.setText("FLEXY");
        watermark.setTextColor(0xFF9A9AA2);
        watermark.setAlpha(0.5f);
        watermark.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        watermark.setLetterSpacing(0.14f);
        watermark.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        watermark.setClickable(false);
        watermark.setFocusable(false);
        FrameLayout.LayoutParams wmParams = new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.LEFT);
        wmParams.setMargins(dp(20), dp(4), 0, 0);
        root.addView(watermark, wmParams);

        playerView.setControllerVisibilityListener((PlayerView.ControllerVisibilityListener) visibility -> {
            top.setVisibility(visibility);
            if (visibility != View.VISIBLE) hideSystemBars();
        });
        setContentView(root);

        buildPlayer(in, url);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                finishWithResult();
            }
        });
    }

    private void buildPlayer(Intent in, String url) {
        // Network: app user agent, redirects across http/https, addon-provided headers.
        Map<String, String> headers = new HashMap<>();
        Bundle hb = in.getBundleExtra(EXTRA_HEADERS);
        String userAgent = "FLEXY/1.0 (Android) ExoPlayer";
        if (hb != null) {
            for (String k : hb.keySet()) {
                String v = hb.getString(k);
                if (v == null) continue;
                if (k.equalsIgnoreCase("User-Agent")) userAgent = v;
                else headers.put(k, v);
            }
        }
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
            .setUserAgent(userAgent)
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(15000)
            .setReadTimeoutMs(20000)
            .setDefaultRequestProperties(headers);
        DataSource.Factory dataSource = new DefaultDataSource.Factory(this, http);

        // Quality: always the best rendition the device can decode when asked.
        String subLang = in.getStringExtra(EXTRA_SUB_LANG);
        DefaultTrackSelector selector = new DefaultTrackSelector(this);
        DefaultTrackSelector.Parameters.Builder params = selector.buildUponParameters()
            .setForceHighestSupportedBitrate(in.getBooleanExtra(EXTRA_HIGHEST, true))
            .setExceedRendererCapabilitiesIfNecessary(true)
            .setPreferredAudioLanguages("ar", "en");
        if (subLang != null && !subLang.isEmpty()) params.setPreferredTextLanguage(iso2(subLang));
        selector.setParameters(params.build());

        // Speed: start after ~1 s of media, keep a large forward buffer for smoothness.
        DefaultLoadControl loadControl = new DefaultLoadControl.Builder()
            .setBufferDurationsMs(15_000, 120_000, 1_000, 2_500)
            .setPrioritizeTimeOverSizeThresholds(true)
            .build();

        DefaultRenderersFactory renderers = new DefaultRenderersFactory(this)
            .setEnableDecoderFallback(true)
            .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_ON);

        player = new ExoPlayer.Builder(this, renderers)
            .setMediaSourceFactory(new DefaultMediaSourceFactory(dataSource))
            .setTrackSelector(selector)
            .setLoadControl(loadControl)
            .setSeekBackIncrementMs(10_000)
            .setSeekForwardIncrementMs(10_000)
            .setHandleAudioBecomingNoisy(true)
            .setAudioAttributes(AudioAttributes.DEFAULT, true)
            .build();
        playerView.setPlayer(player);

        MediaItem.Builder item = new MediaItem.Builder()
            .setUri(Uri.parse(url))
            .setMediaMetadata(new MediaMetadata.Builder().setTitle(in.getStringExtra(EXTRA_TITLE)).build());
        String lower = url.toLowerCase(Locale.ROOT);
        if (lower.contains(".m3u8") || lower.contains("m3u8?") || lower.contains("/hls")) item.setMimeType(MimeTypes.APPLICATION_M3U8);
        else if (lower.contains(".mpd")) item.setMimeType(MimeTypes.APPLICATION_MPD);

        ArrayList<Bundle> subs = in.getParcelableArrayListExtra(EXTRA_SUBS);
        if (subs != null && !subs.isEmpty()) {
            List<MediaItem.SubtitleConfiguration> configs = new ArrayList<>();
            boolean defaultSet = false;
            for (Bundle s : subs) {
                String su = s.getString("url");
                if (su == null) continue;
                String lang = s.getString("lang", "");
                boolean isDefault = !defaultSet && subLang != null && iso2(lang).equals(iso2(subLang));
                if (isDefault) defaultSet = true;
                configs.add(new MediaItem.SubtitleConfiguration.Builder(Uri.parse(su))
                    .setMimeType(subtitleMime(su))
                    .setLanguage(iso2(lang))
                    .setLabel(s.getString("label", lang))
                    .setSelectionFlags(isDefault ? C.SELECTION_FLAG_DEFAULT : 0)
                    .build());
            }
            item.setSubtitleConfigurations(configs);
        }

        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_ENDED) {
                    ended = true;
                    finishWithResult();
                }
            }

            @Override
            public void onPlayerError(@NonNull PlaybackException e) {
                if (e.errorCode == PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW) {
                    // Live stream fell behind: jump back to the live edge.
                    player.seekToDefaultPosition();
                    player.prepare();
                    return;
                }
                error = e.getErrorCodeName();
                finishWithResult();
            }
        });

        long startMs = in.getLongExtra(EXTRA_START_MS, 0);
        player.setMediaItem(item.build(), startMs > 0 ? startMs : C.TIME_UNSET);
        player.setPlayWhenReady(true);
        player.prepare();
    }

    private static String subtitleMime(String url) {
        String u = url.toLowerCase(Locale.ROOT);
        if (u.contains(".vtt")) return MimeTypes.TEXT_VTT;
        if (u.contains(".ass") || u.contains(".ssa")) return MimeTypes.TEXT_SSA;
        if (u.contains(".ttml") || u.contains(".dfxp")) return MimeTypes.APPLICATION_TTML;
        return MimeTypes.APPLICATION_SUBRIP;
    }

    /** "ara" / "eng" (Stremio) → "ar" / "en" (what ExoPlayer matches on). */
    private static String iso2(String lang) {
        if (lang == null) return "";
        String l = lang.toLowerCase(Locale.ROOT);
        if (l.length() == 3) {
            for (Locale loc : Locale.getAvailableLocales()) {
                try {
                    if (l.equals(loc.getISO3Language())) return loc.getLanguage();
                } catch (Exception ignored) {
                    // some locales have no ISO3 code
                }
            }
            if (l.equals("fre")) return "fr";
            if (l.equals("ger")) return "de";
            if (l.equals("per")) return "fa";
            if (l.equals("chi")) return "zh";
            if (l.equals("dut")) return "nl";
            if (l.equals("pob")) return "pt";
        }
        return l.length() > 2 ? l.substring(0, 2) : l;
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        View decor = getWindow().getDecorView();
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), decor);
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
        // Older Android versions / some OEM skins still need the legacy flags.
        decor.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    protected void onResume() {
        super.onResume();
        getWindow().getDecorView().post(this::hideSystemBars);
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private void finishWithResult() {
        if (finished) return;
        finished = true;
        Intent data = new Intent();
        if (player != null) {
            long duration = player.getDuration();
            data.putExtra(RESULT_POSITION, player.getCurrentPosition());
            data.putExtra(RESULT_DURATION, duration == C.TIME_UNSET ? -1L : duration);
        }
        data.putExtra(RESULT_ENDED, ended);
        if (error != null) data.putExtra(RESULT_ERROR, error);
        setResult(RESULT_OK, data);
        finish();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Re-apply immersive mode once the window exists (and after dialogs/notifications).
        if (hasFocus) hideSystemBars();
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (player != null && !isFinishing()) player.pause();
    }

    @Override
    protected void onDestroy() {
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }
}
