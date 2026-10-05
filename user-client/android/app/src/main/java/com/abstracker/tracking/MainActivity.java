package com.abstracker.tracking;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.addJavascriptInterface(new NativeInterface(this), "AndroidNative");
            }
        } catch (Exception ignored) {}

        // Auto-start monitoring service if user was already logged in
        SharedPreferences prefs = getSharedPreferences("AbsTrackerPrefs", Context.MODE_PRIVATE);
        String authHeader = prefs.getString("auth_header", null);
        if (authHeader != null && !authHeader.trim().isEmpty()) {
            startFleetService();
        }
    }

    public void startFleetService() {
        Intent intent = new Intent(this, FleetMonitoringService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent);
        } else {
            startService(intent);
        }
    }

    public static class NativeInterface {
        private final MainActivity activity;

        public NativeInterface(MainActivity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public void startMonitoring(String authHeader) {
            if (authHeader != null && !authHeader.trim().isEmpty()) {
                SharedPreferences prefs = activity.getSharedPreferences("AbsTrackerPrefs", Context.MODE_PRIVATE);
                prefs.edit().putString("auth_header", authHeader).apply();
                activity.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        activity.startFleetService();
                    }
                });
            }
        }

        @JavascriptInterface
        public void stopMonitoring() {
            SharedPreferences prefs = activity.getSharedPreferences("AbsTrackerPrefs", Context.MODE_PRIVATE);
            prefs.edit().remove("auth_header").apply();
            Intent intent = new Intent(activity, FleetMonitoringService.class);
            activity.stopService(intent);
        }
    }
}
