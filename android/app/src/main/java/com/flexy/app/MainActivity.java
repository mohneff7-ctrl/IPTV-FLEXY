package com.flexy.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // In-app plugins must be registered before the bridge starts.
        registerPlugin(NativePlayerPlugin.class);
        super.onCreate(savedInstanceState);
        // No native scrollbars or edge glow anywhere in the app.
        WebView web = getBridge() != null ? getBridge().getWebView() : null;
        if (web != null) {
            web.setVerticalScrollBarEnabled(false);
            web.setHorizontalScrollBarEnabled(false);
            web.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
            web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        }
    }
}
