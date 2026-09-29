package com.layan.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativePlayerPlugin.class);
        super.onCreate(savedInstanceState);
        WebView webView = getBridge().getWebView();
        // No native scrollbars anywhere: the UI is edge-to-edge like a native app.
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setScrollbarFadingEnabled(true);
        WebSettings settings = webView.getSettings();
        // Start playback (and auto-play the next episode) without an extra tap.
        settings.setMediaPlaybackRequiresUserGesture(false);
    }
}
