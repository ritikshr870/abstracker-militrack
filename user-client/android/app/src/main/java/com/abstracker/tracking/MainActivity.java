package com.abstracker.tracking;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Environment;
import android.util.Base64;
import android.util.Log;
import android.widget.Toast;
import androidx.core.content.FileProvider;

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

        @JavascriptInterface
        public String getBackgroundAlerts() {
            SharedPreferences prefs = activity.getSharedPreferences("AbsTrackerPrefs", Context.MODE_PRIVATE);
            return prefs.getString("background_alerts_history", "[]");
        }

        @JavascriptInterface
        public void clearBackgroundAlerts() {
            SharedPreferences prefs = activity.getSharedPreferences("AbsTrackerPrefs", Context.MODE_PRIVATE);
            prefs.edit().putString("background_alerts_history", "[]").apply();
        }

        @JavascriptInterface
        public void saveBase64File(String base64Data, String filename, String mimeType) {
            try {
                if (base64Data == null || base64Data.trim().isEmpty()) return;

                String cleanBase64 = base64Data;
                if (cleanBase64.contains(",")) {
                    cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
                }

                byte[] bytes = Base64.decode(cleanBase64, Base64.DEFAULT);

                // Use public Downloads directory or app external files directory
                File downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!downloadDir.exists()) {
                    downloadDir.mkdirs();
                }

                File targetFile = new File(downloadDir, filename);
                FileOutputStream fos = new FileOutputStream(targetFile);
                fos.write(bytes);
                fos.flush();
                fos.close();

                MediaScannerConnection.scanFile(
                    activity,
                    new String[]{ targetFile.getAbsolutePath() },
                    new String[]{ mimeType },
                    null
                );

                activity.runOnUiThread(() -> {
                    Toast.makeText(activity, "Report saved: " + filename, Toast.LENGTH_LONG).show();

                    try {
                        Uri contentUri = FileProvider.getUriForFile(
                            activity,
                            activity.getPackageName() + ".fileprovider",
                            targetFile
                        );
                        Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                        viewIntent.setDataAndType(contentUri, mimeType);
                        viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        activity.startActivity(Intent.createChooser(viewIntent, "Open " + filename));
                    } catch (Exception e) {
                        Log.w("MainActivity", "Viewer launch failed: " + e.getMessage());
                    }
                });
            } catch (Exception e) {
                Log.e("MainActivity", "Failed to save file: " + e.getMessage(), e);
                activity.runOnUiThread(() -> Toast.makeText(activity, "Download failed: " + e.getMessage(), Toast.LENGTH_LONG).show());
            }
        }
    }
}
