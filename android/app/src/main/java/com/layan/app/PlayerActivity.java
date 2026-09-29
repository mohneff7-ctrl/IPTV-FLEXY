package com.layan.app;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.GestureDetector;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.annotation.OptIn;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.Tracks;
import androidx.media3.common.VideoSize;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.exoplayer.trackselection.AdaptiveTrackSelection;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector;
import androidx.media3.exoplayer.upstream.DefaultBandwidthMeter;
import androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy;
import androidx.media3.extractor.DefaultExtractorsFactory;
import androidx.media3.extractor.ts.DefaultTsPayloadReaderFactory;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.CaptionStyleCompat;
import androidx.media3.ui.PlayerView;
import androidx.media3.ui.SubtitleView;
import androidx.media3.ui.TrackSelectionDialogBuilder;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Full-screen native player (ExoPlayer / Media3) with hardware decoding.
 * Plays HLS, DASH, SmoothStreaming, RTSP, MPEG-TS / Xtream live, MKV, MP4,
 * WebM, FLV… starts at the best quality the connection allows (up to 1080p
 * and beyond), and recovers on its own from network drops and live-window
 * errors. When a stream really can't be played it closes with an error so the
 * web player can try its own engines.
 */
@OptIn(markerClass = UnstableApi.class)
public class PlayerActivity extends AppCompatActivity {

    static final String EXTRA_URL = "url";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_SUBTITLE = "subtitle";
    static final String EXTRA_START_MS = "startMs";
    static final String EXTRA_LIVE = "live";
    static final String EXTRA_SEEK_STEP_MS = "seekStepMs";
    static final String EXTRA_RESIZE = "resize";
    static final String EXTRA_MAX_HEIGHT = "maxHeight";
    static final String EXTRA_CAP_TO_SCREEN = "capToScreen";
    static final String EXTRA_SUB_LANG = "subLang";
    static final String EXTRA_SUB_SIZE = "subSize";
    static final String EXTRA_SUB_COLOR = "subColor";
    static final String EXTRA_SUB_BG_COLOR = "subBgColor";
    static final String EXTRA_SUB_BG_OPACITY = "subBgOpacity";
    static final String EXTRA_SUB_EDGE = "subEdge";
    static final String EXTRA_SUB_BOLD = "subBold";
    static final String EXTRA_HEADER_KEYS = "headerKeys";
    static final String EXTRA_HEADER_VALUES = "headerValues";
    static final String EXTRA_SUB_URLS = "subUrls";
    static final String EXTRA_SUB_LANGS = "subLangs";
    static final String EXTRA_SUB_LABELS = "subLabels";

    static final String RESULT_POSITION_MS = "positionMs";
    static final String RESULT_DURATION_MS = "durationMs";
    static final String RESULT_ENDED = "ended";
    static final String RESULT_ERROR = "error";

    /** Many IPTV panels only accept player-like user agents. */
    private static final String DEFAULT_USER_AGENT = "VLC/3.0.21 LibVLC/3.0.21";
    private static final int MAX_NETWORK_RETRIES = 6;
    private static final long PROGRESS_INTERVAL_MS = 5000;

    private static final int[] RESIZE_MODES = {
        AspectRatioFrameLayout.RESIZE_MODE_FIT,
        AspectRatioFrameLayout.RESIZE_MODE_ZOOM,
        AspectRatioFrameLayout.RESIZE_MODE_FILL,
    };
    private static final String[] RESIZE_LABELS = {"Fit", "Zoom", "Stretch"};

    private final Handler handler = new Handler(Looper.getMainLooper());

    private ExoPlayer player;
    private DefaultTrackSelector trackSelector;
    private PlayerView playerView;
    private View topBar;
    private TextView qualityBadge;
    private ImageButton qualityButton;
    private TextView seekFeedback;
    private View watermark;

    private Uri uri;
    private boolean live;
    private long seekStepMs;
    private final List<MediaItem.SubtitleConfiguration> subtitleConfigs = new ArrayList<>();
    private boolean subtitlesDropped;
    /** Container/manifest types to try, in order (null = let ExoPlayer sniff it). */
    private final List<String> mimeCandidates = new ArrayList<>();
    private int mimeIndex;
    private int networkRetries;
    private int resizeIndex;
    private boolean resultSent;
    private boolean resumeOnStart;
    private int seekAccumulated;

    private final Runnable progressTick = new Runnable() {
        @Override
        public void run() {
            reportProgress();
            handler.postDelayed(this, PROGRESS_INTERVAL_MS);
        }
    };

    private final Runnable hideSeekFeedback = () -> {
        seekFeedback.setVisibility(View.GONE);
        seekAccumulated = 0;
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_player);
        enterImmersive();

        Intent in = getIntent();
        String url = in.getStringExtra(EXTRA_URL);
        if (url == null || url.isEmpty()) {
            finishWithResult("no-url");
            return;
        }
        uri = Uri.parse(url.trim());
        live = in.getBooleanExtra(EXTRA_LIVE, false);
        seekStepMs = Math.max(5000, in.getLongExtra(EXTRA_SEEK_STEP_MS, 10000));

        playerView = findViewById(R.id.player_view);
        topBar = findViewById(R.id.top_bar);
        qualityBadge = findViewById(R.id.quality_badge);
        qualityButton = findViewById(R.id.btn_quality);
        seekFeedback = findViewById(R.id.seek_feedback);
        watermark = findViewById(R.id.watermark);

        TextView title = findViewById(R.id.title);
        TextView subtitle = findViewById(R.id.subtitle);
        title.setText(in.getStringExtra(EXTRA_TITLE));
        String sub = in.getStringExtra(EXTRA_SUBTITLE);
        if (sub != null && !sub.isEmpty()) {
            subtitle.setText(sub);
            subtitle.setVisibility(View.VISIBLE);
        }

        findViewById(R.id.btn_back).setOnClickListener(v -> finishWithResult(null));
        findViewById(R.id.btn_resize).setOnClickListener(v -> cycleResize());
        qualityButton.setOnClickListener(v -> showQualityDialog());

        String resize = in.getStringExtra(EXTRA_RESIZE);
        resizeIndex = "zoom".equals(resize) ? 1 : "fill".equals(resize) ? 2 : 0;
        playerView.setResizeMode(RESIZE_MODES[resizeIndex]);
        // Movies & series carry the LAYAN watermark; it hides under the controls. Live TV has none.
        playerView.setControllerVisibilityListener((PlayerView.ControllerVisibilityListener) visibility -> {
            topBar.setVisibility(visibility);
            if (!live) watermark.setVisibility(visibility == View.VISIBLE ? View.GONE : View.VISIBLE);
        });
        applyCutoutPadding();
        styleSubtitles(in);
        setupGestures();

        buildSubtitleConfigs(in);
        buildMimeCandidates(url);
        buildPlayer(in);

        long startMs = in.getLongExtra(EXTRA_START_MS, 0);
        load(live || startMs <= 0 ? C.TIME_UNSET : startMs);
        playerView.requestFocus();

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                finishWithResult(null);
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /* Player setup                                                        */
    /* ------------------------------------------------------------------ */

    private void buildPlayer(Intent in) {
        // Start high: assume a fast connection so the first segments are already
        // HD/1080p instead of ramping up from the lowest rendition.
        DefaultBandwidthMeter bandwidthMeter = new DefaultBandwidthMeter.Builder(this)
            .setInitialBitrateEstimate(12_000_000L)
            .build();

        AdaptiveTrackSelection.Factory adaptive = new AdaptiveTrackSelection.Factory(
            /* minDurationForQualityIncreaseMs= */ 4000,
            /* maxDurationForQualityDecreaseMs= */ 20000,
            /* minDurationToRetainAfterDiscardMs= */ 20000,
            /* bandwidthFraction= */ 0.85f);
        trackSelector = new DefaultTrackSelector(this, adaptive);
        DefaultTrackSelector.Parameters.Builder params = trackSelector.buildUponParameters()
            .setExceedRendererCapabilitiesIfNecessary(true)
            .setAllowVideoMixedMimeTypeAdaptiveness(true)
            .setAllowVideoNonSeamlessAdaptiveness(true);
        // "Best" quality: don't cap to the (often 720p) phone screen, allow 1080p+.
        if (!in.getBooleanExtra(EXTRA_CAP_TO_SCREEN, false)) params.clearViewportSizeConstraints();
        int maxHeight = in.getIntExtra(EXTRA_MAX_HEIGHT, 0);
        if (maxHeight > 0) params.setMaxVideoSize(Integer.MAX_VALUE, maxHeight);
        String subLang = in.getStringExtra(EXTRA_SUB_LANG);
        if (subLang != null && !subLang.isEmpty()) params.setPreferredTextLanguage(subLang);
        trackSelector.setParameters(params);

        // Hardware decoders first, FFmpeg for audio formats the device lacks
        // (AC3 / E-AC3 / DTS / TrueHD in MKV files), and fall back to another
        // decoder if the first one fails to initialise.
        DefaultRenderersFactory renderers = new DefaultRenderersFactory(this)
            .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_ON)
            .setEnableDecoderFallback(true);

        // Start playing after ~1s of media and keep a generous buffer after that.
        DefaultLoadControl loadControl = new DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                /* minBufferMs= */ live ? 8_000 : 25_000,
                /* maxBufferMs= */ live ? 30_000 : 90_000,
                /* bufferForPlaybackMs= */ 1_000,
                /* bufferForPlaybackAfterRebufferMs= */ 2_500)
            .setPrioritizeTimeOverSizeThresholds(true)
            .build();

        Map<String, String> headers = new HashMap<>();
        String userAgent = DEFAULT_USER_AGENT;
        ArrayList<String> keys = in.getStringArrayListExtra(EXTRA_HEADER_KEYS);
        ArrayList<String> values = in.getStringArrayListExtra(EXTRA_HEADER_VALUES);
        if (keys != null && values != null) {
            for (int i = 0; i < Math.min(keys.size(), values.size()); i++) {
                if ("user-agent".equalsIgnoreCase(keys.get(i))) userAgent = values.get(i);
                else headers.put(keys.get(i), values.get(i));
            }
        }
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
            .setUserAgent(userAgent)
            .setAllowCrossProtocolRedirects(true)
            .setKeepPostFor302Redirects(true)
            .setConnectTimeoutMs(15_000)
            .setReadTimeoutMs(20_000)
            .setDefaultRequestProperties(headers);
        DefaultDataSource.Factory dataSource = new DefaultDataSource.Factory(this, http);

        // IPTV MPEG-TS streams often lack IDR frames / access unit delimiters.
        DefaultExtractorsFactory extractors = new DefaultExtractorsFactory()
            .setConstantBitrateSeekingEnabled(true)
            .setTsExtractorFlags(
                DefaultTsPayloadReaderFactory.FLAG_ALLOW_NON_IDR_KEYFRAMES
                    | DefaultTsPayloadReaderFactory.FLAG_DETECT_ACCESS_UNITS);

        DefaultMediaSourceFactory mediaSources = new DefaultMediaSourceFactory(dataSource, extractors)
            .setLoadErrorHandlingPolicy(new DefaultLoadErrorHandlingPolicy(6));

        player = new ExoPlayer.Builder(this, renderers, mediaSources)
            .setTrackSelector(trackSelector)
            .setLoadControl(loadControl)
            .setBandwidthMeter(bandwidthMeter)
            .setSeekBackIncrementMs(seekStepMs)
            .setSeekForwardIncrementMs(seekStepMs)
            .setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                    .build(),
                /* handleAudioFocus= */ true)
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .build();
        player.addListener(new PlayerListener());
        playerView.setPlayer(player);
    }

    private void buildMimeCandidates(String url) {
        String u = url.toLowerCase(Locale.ROOT);
        String path = u.split("[?#]")[0];
        String guess = null;
        if (path.endsWith(".m3u8") || path.endsWith(".m3u") || u.contains("m3u8") || u.contains("/hls/")
            || u.contains("type=hls") || u.contains("format=hls")) {
            guess = MimeTypes.APPLICATION_M3U8;
        } else if (path.endsWith(".mpd") || u.contains("format=mpd") || u.contains("/dash/")) {
            guess = MimeTypes.APPLICATION_MPD;
        } else if (path.endsWith(".ism/manifest") || path.endsWith(".isml/manifest")) {
            guess = MimeTypes.APPLICATION_SS;
        }
        mimeCandidates.add(guess);
        if (u.startsWith("rtsp://") || u.startsWith("rtsps://")) return;
        // Extension-less URLs are often HLS behind a redirect, or plain TS/MP4.
        if (guess == null) mimeCandidates.add(MimeTypes.APPLICATION_M3U8);
        else mimeCandidates.add(null);
    }

    private void buildSubtitleConfigs(Intent in) {
        ArrayList<String> urls = in.getStringArrayListExtra(EXTRA_SUB_URLS);
        ArrayList<String> langs = in.getStringArrayListExtra(EXTRA_SUB_LANGS);
        ArrayList<String> labels = in.getStringArrayListExtra(EXTRA_SUB_LABELS);
        if (urls == null) return;
        for (int i = 0; i < urls.size(); i++) {
            String u = urls.get(i);
            String lang = langs != null && i < langs.size() ? langs.get(i) : null;
            String label = labels != null && i < labels.size() ? labels.get(i) : lang;
            subtitleConfigs.add(new MediaItem.SubtitleConfiguration.Builder(Uri.parse(u))
                .setMimeType(subtitleMime(u))
                .setLanguage(lang == null || lang.isEmpty() ? null : lang)
                .setLabel(label)
                .setId("ext" + i)
                .build());
        }
    }

    private static String subtitleMime(String url) {
        String path = url.toLowerCase(Locale.ROOT).split("[?#]")[0];
        if (path.endsWith(".vtt") || path.endsWith(".webvtt")) return MimeTypes.TEXT_VTT;
        if (path.endsWith(".ass") || path.endsWith(".ssa")) return MimeTypes.TEXT_SSA;
        if (path.endsWith(".ttml") || path.endsWith(".dfxp") || path.endsWith(".xml")) return MimeTypes.APPLICATION_TTML;
        // Stremio subtitle addons (OpenSubtitles…) serve SRT, usually without an extension.
        return MimeTypes.APPLICATION_SUBRIP;
    }

    private void load(long positionMs) {
        MediaItem.Builder item = new MediaItem.Builder().setUri(uri);
        String mime = mimeCandidates.get(mimeIndex);
        if (mime != null) item.setMimeType(mime);
        if (!subtitlesDropped && !subtitleConfigs.isEmpty()) item.setSubtitleConfigurations(subtitleConfigs);
        if (positionMs == C.TIME_UNSET) player.setMediaItem(item.build(), /* resetPosition= */ true);
        else player.setMediaItem(item.build(), positionMs);
        player.prepare();
        player.setPlayWhenReady(true);
    }

    private long resumePosition() {
        if (live || player.isCurrentMediaItemLive()) return C.TIME_UNSET;
        long pos = player.getCurrentPosition();
        return pos > 0 ? pos : C.TIME_UNSET;
    }

    /* ------------------------------------------------------------------ */
    /* Error recovery                                                      */
    /* ------------------------------------------------------------------ */

    private class PlayerListener implements Player.Listener {
        @Override
        public void onPlayerError(@NonNull PlaybackException error) {
            recover(error);
        }

        @Override
        public void onPlaybackStateChanged(int state) {
            if (state == Player.STATE_READY) networkRetries = 0;
            if (state == Player.STATE_ENDED && !live && !player.isCurrentMediaItemLive()) {
                Intent data = resultIntent();
                data.putExtra(RESULT_ENDED, true);
                sendResult(data);
            }
        }

        @Override
        public void onIsPlayingChanged(boolean isPlaying) {
            handler.removeCallbacks(progressTick);
            if (isPlaying) handler.postDelayed(progressTick, PROGRESS_INTERVAL_MS);
            else reportProgress();
        }

        @Override
        public void onTracksChanged(@NonNull Tracks tracks) {
            int videoTracks = 0;
            for (Tracks.Group group : tracks.getGroups()) {
                if (group.getType() != C.TRACK_TYPE_VIDEO) continue;
                for (int i = 0; i < group.length; i++) if (group.isTrackSupported(i)) videoTracks++;
            }
            qualityButton.setVisibility(videoTracks > 1 ? View.VISIBLE : View.GONE);
        }

        @Override
        public void onVideoSizeChanged(@NonNull VideoSize size) {
            if (size.width <= 0 || size.height <= 0) {
                qualityBadge.setVisibility(View.GONE);
                return;
            }
            // Judge by both sides so wide 1920×800 films still read as 1080p.
            int w = Math.max(size.width, size.height);
            int h = Math.min(size.width, size.height);
            String label = w >= 3800 || h >= 2000 ? "4K"
                : w >= 2500 || h >= 1400 ? "1440p"
                : w >= 1900 || h >= 1000 ? "1080p"
                : w >= 1260 || h >= 700 ? "720p"
                : h + "p";
            qualityBadge.setText(label);
            qualityBadge.setVisibility(View.VISIBLE);
        }
    }

    private void recover(PlaybackException error) {
        int code = error.errorCode;

        // Live stream fell behind the window: jump back to the live edge.
        if (code == PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW) {
            player.seekToDefaultPosition();
            player.prepare();
            return;
        }

        // Temporary network trouble: retry with back-off, keeping the position.
        boolean transientNetwork = code == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED
            || code == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT
            || code == PlaybackException.ERROR_CODE_IO_UNSPECIFIED
            || code == PlaybackException.ERROR_CODE_TIMEOUT;
        if (transientNetwork && networkRetries < MAX_NETWORK_RETRIES) {
            networkRetries++;
            long pos = resumePosition();
            handler.postDelayed(() -> {
                if (player != null) load(pos);
            }, Math.min(8000, 1000L * networkRetries));
            return;
        }

        // A broken external subtitle must never block the video: drop them.
        if (!subtitlesDropped && !subtitleConfigs.isEmpty()) {
            subtitlesDropped = true;
            load(resumePosition());
            return;
        }

        // Wrong container guess (e.g. HLS without .m3u8): try the next type.
        if (mimeIndex + 1 < mimeCandidates.size()) {
            mimeIndex++;
            networkRetries = 0;
            load(resumePosition());
            return;
        }

        finishWithResult(error.getErrorCodeName());
    }

    /* ------------------------------------------------------------------ */
    /* UI                                                                   */
    /* ------------------------------------------------------------------ */

    private void enterImmersive() {
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    /** TV remotes / keyboards: D-pad and media keys go to the player first. */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        return (playerView != null && playerView.dispatchKeyEvent(event)) || super.dispatchKeyEvent(event);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterImmersive();
    }

    /** Keeps the top bar buttons clear of camera notches. */
    private void applyCutoutPadding() {
        final int left = topBar.getPaddingLeft();
        final int top = topBar.getPaddingTop();
        final int right = topBar.getPaddingRight();
        final int bottom = topBar.getPaddingBottom();
        ViewCompat.setOnApplyWindowInsetsListener(topBar, (v, insets) -> {
            Insets cut = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            v.setPadding(left + cut.left, top + cut.top, right + cut.right, bottom);
            return insets;
        });
    }

    /** Applies the subtitle look chosen in LAYAN's settings (colour, box, edge, size, weight). */
    private void styleSubtitles(Intent in) {
        SubtitleView sv = playerView.getSubtitleView();
        if (sv == null) return;
        int text = parseColor(in.getStringExtra(EXTRA_SUB_COLOR), Color.WHITE);
        int boxAlpha = Math.round(Math.max(0, Math.min(100, in.getIntExtra(EXTRA_SUB_BG_OPACITY, 60))) * 2.55f);
        int box = (parseColor(in.getStringExtra(EXTRA_SUB_BG_COLOR), Color.BLACK) & 0x00FFFFFF) | (boxAlpha << 24);
        String edge = in.getStringExtra(EXTRA_SUB_EDGE);
        int edgeType = "outline".equals(edge) ? CaptionStyleCompat.EDGE_TYPE_OUTLINE
            : "none".equals(edge) ? CaptionStyleCompat.EDGE_TYPE_NONE
            : CaptionStyleCompat.EDGE_TYPE_DROP_SHADOW;
        boolean bold = in.getBooleanExtra(EXTRA_SUB_BOLD, true);
        sv.setStyle(new CaptionStyleCompat(
            text,
            boxAlpha == 0 ? Color.TRANSPARENT : box,
            Color.TRANSPARENT,
            edgeType,
            Color.BLACK,
            bold ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT));
        int size = in.getIntExtra(EXTRA_SUB_SIZE, 100);
        sv.setFractionalTextSize(SubtitleView.DEFAULT_TEXT_SIZE_FRACTION * Math.max(50, size) / 100f);
    }

    private static int parseColor(String value, int fallback) {
        try {
            return value == null ? fallback : Color.parseColor(value);
        } catch (IllegalArgumentException e) {
            return fallback;
        }
    }

    /** Single tap: show/hide controls. Double tap on a side: seek, in the middle: play/pause. */
    @SuppressLint("ClickableViewAccessibility")
    private void setupGestures() {
        GestureDetector detector = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override
            public boolean onDown(@NonNull MotionEvent e) {
                return true;
            }

            @Override
            public boolean onSingleTapConfirmed(@NonNull MotionEvent e) {
                if (playerView.isControllerFullyVisible()) playerView.hideController();
                else playerView.showController();
                return true;
            }

            @Override
            public boolean onDoubleTap(@NonNull MotionEvent e) {
                if (player == null) return true;
                float x = e.getX() / Math.max(1, playerView.getWidth());
                boolean rtl = playerView.getLayoutDirection() == View.LAYOUT_DIRECTION_RTL;
                if (x > 0.35f && x < 0.65f) {
                    if (player.isPlaying()) player.pause();
                    else player.play();
                } else if (!live && player.isCurrentMediaItemSeekable()) {
                    boolean forward = (x >= 0.65f) != rtl;
                    if (forward) player.seekForward();
                    else player.seekBack();
                    showSeekFeedback(forward);
                }
                return true;
            }
        });
        playerView.setOnTouchListener((v, event) -> detector.onTouchEvent(event));
    }

    private void showSeekFeedback(boolean forward) {
        int step = (int) (seekStepMs / 1000);
        boolean sameDirection = seekFeedback.getVisibility() == View.VISIBLE && (seekAccumulated > 0) == forward;
        seekAccumulated = (sameDirection ? seekAccumulated : 0) + (forward ? step : -step);
        seekFeedback.setText(forward ? "»  +" + seekAccumulated + "s" : "«  " + seekAccumulated + "s");
        seekFeedback.setVisibility(View.VISIBLE);
        handler.removeCallbacks(hideSeekFeedback);
        handler.postDelayed(hideSeekFeedback, 700);
    }

    private void cycleResize() {
        resizeIndex = (resizeIndex + 1) % RESIZE_MODES.length;
        playerView.setResizeMode(RESIZE_MODES[resizeIndex]);
        Toast.makeText(this, RESIZE_LABELS[resizeIndex], Toast.LENGTH_SHORT).show();
    }

    private void showQualityDialog() {
        if (player == null) return;
        new TrackSelectionDialogBuilder(this, "Quality", player, C.TRACK_TYPE_VIDEO)
            .setShowDisableOption(false)
            .setAllowAdaptiveSelections(true)
            .setTrackNameProvider(PlayerActivity::qualityName)
            .setTheme(androidx.appcompat.R.style.Theme_AppCompat_Dialog_Alert)
            .build()
            .show();
    }

    private static String qualityName(Format f) {
        StringBuilder s = new StringBuilder();
        if (f.height > 0) s.append(f.height).append('p');
        if (f.frameRate > 30) s.append(Math.round(f.frameRate));
        if (f.bitrate > 0) {
            if (s.length() > 0) s.append(" · ");
            s.append(String.format(Locale.US, "%.1f Mbps", f.bitrate / 1_000_000f));
        }
        return s.length() > 0 ? s.toString() : "Auto";
    }

    /* ------------------------------------------------------------------ */
    /* Progress & result                                                    */
    /* ------------------------------------------------------------------ */

    private void reportProgress() {
        if (player == null || live) return;
        long duration = player.getDuration();
        if (duration == C.TIME_UNSET || duration <= 0) return;
        NativePlayerPlugin.emitProgress(player.getCurrentPosition(), duration);
    }

    private Intent resultIntent() {
        Intent data = new Intent();
        if (player != null) {
            long duration = player.getDuration();
            data.putExtra(RESULT_POSITION_MS, Math.max(0, player.getCurrentPosition()));
            data.putExtra(RESULT_DURATION_MS, duration == C.TIME_UNSET ? 0 : duration);
        }
        return data;
    }

    private void finishWithResult(String error) {
        Intent data = resultIntent();
        if (error != null) data.putExtra(RESULT_ERROR, error);
        sendResult(data);
    }

    private void sendResult(Intent data) {
        if (resultSent) return;
        resultSent = true;
        setResult(RESULT_OK, data);
        finish();
    }

    /* ------------------------------------------------------------------ */
    /* Lifecycle                                                            */
    /* ------------------------------------------------------------------ */

    @Override
    protected void onStart() {
        super.onStart();
        if (player != null && resumeOnStart) player.play();
        resumeOnStart = false;
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (player != null) {
            resumeOnStart = player.getPlayWhenReady();
            player.pause();
            reportProgress();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        handler.removeCallbacksAndMessages(null);
        if (player != null) {
            player.release();
            player = null;
        }
    }
}
