package com.flexy.app;

import android.content.Intent;
import android.os.Bundle;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Iterator;

/** JS bridge: NativePlayer.play({...}) → PlayerActivity → { position, duration, ended, error }. */
@CapacitorPlugin(name = "NativePlayer")
public class NativePlayerPlugin extends Plugin {

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
        intent.putExtra(PlayerActivity.EXTRA_START_MS, call.getLong("startMs", 0L));
        intent.putExtra(PlayerActivity.EXTRA_HIGHEST, call.getBoolean("highest", true));
        intent.putExtra(PlayerActivity.EXTRA_SUB_LANG, call.getString("subLang", ""));

        JSObject headers = call.getObject("headers", new JSObject());
        Bundle hb = new Bundle();
        Iterator<String> keys = headers.keys();
        while (keys.hasNext()) {
            String k = keys.next();
            hb.putString(k, headers.optString(k));
        }
        intent.putExtra(PlayerActivity.EXTRA_HEADERS, hb);

        ArrayList<Bundle> subs = new ArrayList<>();
        JSArray arr = call.getArray("subtitles", new JSArray());
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o == null || o.optString("url").isEmpty()) continue;
            Bundle b = new Bundle();
            b.putString("url", o.optString("url"));
            b.putString("lang", o.optString("lang"));
            b.putString("label", o.optString("label", o.optString("lang")));
            subs.add(b);
        }
        intent.putParcelableArrayListExtra(PlayerActivity.EXTRA_SUBS, subs);

        startActivityForResult(call, intent, "onPlayerResult");
    }

    @ActivityCallback
    private void onPlayerResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject r = new JSObject();
        Intent data = result.getData();
        if (data != null) {
            r.put("position", data.getLongExtra(PlayerActivity.RESULT_POSITION, 0));
            r.put("duration", data.getLongExtra(PlayerActivity.RESULT_DURATION, -1));
            r.put("ended", data.getBooleanExtra(PlayerActivity.RESULT_ENDED, false));
            String err = data.getStringExtra(PlayerActivity.RESULT_ERROR);
            if (err != null) r.put("error", err);
        }
        call.resolve(r);
    }
}
