package com.layan.app;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Iterator;
import org.json.JSONObject;

/**
 * Bridge between the web app and {@link PlayerActivity} (ExoPlayer).
 * {@code play()} resolves when the player closes, with the last position, and
 * emits {@code progress} events while it is open.
 */
@CapacitorPlugin(name = "NativePlayer")
public class NativePlayerPlugin extends Plugin {

    private static NativePlayerPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    /** Called by the player every few seconds so progress survives a crash / kill. */
    static void emitProgress(long positionMs, long durationMs) {
        NativePlayerPlugin p = instance;
        if (p == null) return;
        JSObject data = new JSObject();
        data.put("position", positionMs / 1000.0);
        data.put("duration", durationMs / 1000.0);
        p.notifyListeners("progress", data);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void play(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url is required");
            return;
        }
        Intent intent = new Intent(getContext(), PlayerActivity.class);
        intent.putExtra(PlayerActivity.EXTRA_URL, url);
        intent.putExtra(PlayerActivity.EXTRA_TITLE, call.getString("title", ""));
        intent.putExtra(PlayerActivity.EXTRA_SUBTITLE, call.getString("subtitle", ""));
        intent.putExtra(PlayerActivity.EXTRA_START_MS, (long) (call.getDouble("startPosition", 0.0) * 1000));
        intent.putExtra(PlayerActivity.EXTRA_LIVE, call.getBoolean("live", false));
        intent.putExtra(PlayerActivity.EXTRA_SEEK_STEP_MS, call.getInt("seekStep", 10) * 1000L);
        intent.putExtra(PlayerActivity.EXTRA_RESIZE, call.getString("resizeMode", "fit"));
        intent.putExtra(PlayerActivity.EXTRA_MAX_HEIGHT, call.getInt("maxHeight", 0));
        intent.putExtra(PlayerActivity.EXTRA_CAP_TO_SCREEN, call.getBoolean("capToScreen", false));
        intent.putExtra(PlayerActivity.EXTRA_SUB_LANG, call.getString("subtitleLang", ""));
        intent.putExtra(PlayerActivity.EXTRA_SUB_SIZE, call.getInt("subtitleSize", 100));
        intent.putExtra(PlayerActivity.EXTRA_SUB_COLOR, call.getString("subtitleColor", "#ffffff"));
        intent.putExtra(PlayerActivity.EXTRA_SUB_BG_COLOR, call.getString("subtitleBgColor", "#000000"));
        intent.putExtra(PlayerActivity.EXTRA_SUB_BG_OPACITY, call.getInt("subtitleBgOpacity", 60));
        intent.putExtra(PlayerActivity.EXTRA_SUB_EDGE, call.getString("subtitleEdge", "shadow"));
        intent.putExtra(PlayerActivity.EXTRA_SUB_BOLD, call.getBoolean("subtitleBold", true));

        JSObject headers = call.getObject("headers", new JSObject());
        ArrayList<String> headerKeys = new ArrayList<>();
        ArrayList<String> headerValues = new ArrayList<>();
        Iterator<String> keys = headers.keys();
        while (keys.hasNext()) {
            String k = keys.next();
            String v = headers.optString(k, null);
            if (v != null) {
                headerKeys.add(k);
                headerValues.add(v);
            }
        }
        intent.putStringArrayListExtra(PlayerActivity.EXTRA_HEADER_KEYS, headerKeys);
        intent.putStringArrayListExtra(PlayerActivity.EXTRA_HEADER_VALUES, headerValues);

        ArrayList<String> subUrls = new ArrayList<>();
        ArrayList<String> subLangs = new ArrayList<>();
        ArrayList<String> subLabels = new ArrayList<>();
        JSArray subs = call.getArray("subtitles", new JSArray());
        for (int i = 0; i < subs.length(); i++) {
            JSONObject s = subs.optJSONObject(i);
            if (s == null || s.optString("url", "").isEmpty()) continue;
            subUrls.add(s.optString("url"));
            subLangs.add(s.optString("lang", ""));
            subLabels.add(s.optString("label", s.optString("lang", "")));
        }
        intent.putStringArrayListExtra(PlayerActivity.EXTRA_SUB_URLS, subUrls);
        intent.putStringArrayListExtra(PlayerActivity.EXTRA_SUB_LANGS, subLangs);
        intent.putStringArrayListExtra(PlayerActivity.EXTRA_SUB_LABELS, subLabels);

        startActivityForResult(call, intent, "onPlayerClosed");
    }

    @ActivityCallback
    private void onPlayerClosed(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        JSObject ret = new JSObject();
        if (data != null) {
            ret.put("position", data.getLongExtra(PlayerActivity.RESULT_POSITION_MS, 0) / 1000.0);
            ret.put("duration", data.getLongExtra(PlayerActivity.RESULT_DURATION_MS, 0) / 1000.0);
            ret.put("ended", data.getBooleanExtra(PlayerActivity.RESULT_ENDED, false));
            String error = data.getStringExtra(PlayerActivity.RESULT_ERROR);
            if (error != null) ret.put("error", error);
        } else {
            ret.put("position", 0);
            ret.put("duration", 0);
            ret.put("ended", false);
            if (result.getResultCode() != Activity.RESULT_OK) ret.put("cancelled", true);
        }
        call.resolve(ret);
    }
}
