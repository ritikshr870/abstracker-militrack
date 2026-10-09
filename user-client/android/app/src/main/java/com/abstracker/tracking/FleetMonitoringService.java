package com.abstracker.tracking;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.speech.tts.TextToSpeech;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import android.app.AlarmManager;
import android.os.SystemClock;

public class FleetMonitoringService extends Service implements TextToSpeech.OnInitListener {

    private static final String TAG = "FleetMonitoringService";
    public static final String CHANNEL_SERVICE_ID = "abstracker-service-channel";
    public static final String CHANNEL_ALERT_ID = "abstracker-telematics-alerts";
    private static final int SERVICE_NOTIFICATION_ID = 8801;

    private Thread workerThread;
    private volatile boolean isRunning = false;
    private TextToSpeech tts;
    private boolean ttsReady = false;

    // Cache of device names: deviceId -> formatted name
    private final Map<Integer, String> deviceNames = new HashMap<>();
    // Ignition history: deviceId -> isIgnitionOn
    private final Map<Integer, Boolean> prevIgnitions = new HashMap<>();
    private long lastDevicesFetchTime = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "FleetMonitoringService onCreate");

        createNotificationChannels();
        initTextToSpeech();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "FleetMonitoringService onStartCommand");

        // Start as foreground service to prevent OS kills
        Notification serviceNotification = buildServiceNotification();
        startForeground(SERVICE_NOTIFICATION_ID, serviceNotification);

        startWorkerThread();

        return START_STICKY;
    }

    private synchronized void startWorkerThread() {
        if (isRunning && workerThread != null && workerThread.isAlive()) {
            return;
        }
        isRunning = true;
        workerThread = new Thread(() -> {
            Log.i(TAG, "Background polling worker thread active");
            while (isRunning) {
                try {
                    checkFleetTelematics();
                } catch (Throwable t) {
                    Log.w(TAG, "checkFleetTelematics error: " + t.getMessage());
                }

                try {
                    Thread.sleep(8000); // 8-second continuous polling
                } catch (InterruptedException ie) {
                    break;
                }
            }
        }, "AbsTrackerWorkerThread");
        workerThread.setDaemon(true);
        workerThread.start();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        Log.i(TAG, "onTaskRemoved: App closed/swiped away. Scheduling immediate resurrection via AlarmManager...");

        // Resurrect service 1 second after app swipe-close
        scheduleServiceResurrection();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.i(TAG, "FleetMonitoringService onDestroy");
        isRunning = false;
        if (workerThread != null) {
            workerThread.interrupt();
        }
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }

        // If user is still logged in, make sure service comes right back
        SharedPreferences prefs = getSharedPreferences("AbsTrackerPrefs", Context.MODE_PRIVATE);
        String authHeader = prefs.getString("auth_header", null);
        if (authHeader != null && !authHeader.trim().isEmpty()) {
            scheduleServiceResurrection();
        }
    }

    private void scheduleServiceResurrection() {
        try {
            Intent restartIntent = new Intent(getApplicationContext(), FleetMonitoringService.class);
            restartIntent.setPackage(getPackageName());

            PendingIntent pendingIntent = PendingIntent.getService(
                    getApplicationContext(),
                    1001,
                    restartIntent,
                    PendingIntent.FLAG_ONE_SHOT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            AlarmManager alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null) {
                long triggerAt = SystemClock.elapsedRealtime() + 1000;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingIntent);
                } else {
                    alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingIntent);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "scheduleServiceResurrection failed: " + e.getMessage());
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;

            // 1. Silent persistent channel for the ongoing foreground service
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_SERVICE_ID,
                    "AbsTracker Background Fleet Monitor",
                    NotificationManager.IMPORTANCE_LOW
            );
            serviceChannel.setDescription("Keeps AbsTracker live connection active for background ignition alerts");
            serviceChannel.setShowBadge(false);
            nm.createNotificationChannel(serviceChannel);

            // 2. High-priority alert channel with loud sound and heads-up banner for ignition events
            NotificationChannel alertChannel = new NotificationChannel(
                    CHANNEL_ALERT_ID,
                    "AbsTracker Vehicle Alerts",
                    NotificationManager.IMPORTANCE_HIGH
            );
            alertChannel.setDescription("Critical vehicle ignition, overspeed, and security telematics alerts");
            alertChannel.enableVibration(true);
            alertChannel.setVibrationPattern(new long[]{0, 350, 200, 350});
            alertChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            Uri defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                    .build();
            alertChannel.setSound(defaultSound, audioAttributes);

            nm.createNotificationChannel(alertChannel);
        }
    }

    private Notification buildServiceNotification() {
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, launchIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
        );

        return new NotificationCompat.Builder(this, CHANNEL_SERVICE_ID)
                .setContentTitle("AbsTracker Fleet Guard Active")
                .setContentText("Monitoring live vehicle ignition & GPS telematics 24x7")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void initTextToSpeech() {
        try {
            tts = new TextToSpeech(this, this);
        } catch (Exception e) {
            Log.e(TAG, "TTS init error: " + e.getMessage());
        }
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            int result = tts.setLanguage(Locale.US);
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                result = tts.setLanguage(Locale.getDefault());
            }
            ttsReady = (result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED);
            tts.setSpeechRate(1.0f);
            tts.setPitch(1.0f);
            Log.i(TAG, "TextToSpeech initialized successfully, ready=" + ttsReady);
        }
    }

    private void speakAlert(String text) {
        if (ttsReady && tts != null) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "telematics_" + System.currentTimeMillis());
                } else {
                    tts.speak(text, TextToSpeech.QUEUE_FLUSH, null);
                }
            } catch (Exception e) {
                Log.e(TAG, "TTS speak error: " + e.getMessage());
            }
        }
    }

    private void checkFleetTelematics() {
        SharedPreferences prefs = getSharedPreferences("AbsTrackerPrefs", Context.MODE_PRIVATE);
        String authHeader = prefs.getString("auth_header", null);
        if (authHeader == null || authHeader.trim().isEmpty()) {
            return;
        }

        PowerManager.WakeLock wakeLock = null;
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "abstracker:telematics_check");
                wakeLock.acquire(15000); // 15 seconds max hold
            }

            long now = System.currentTimeMillis();

            // Refresh device names cache every 2 minutes
            if (now - lastDevicesFetchTime > 120000 || deviceNames.isEmpty()) {
                fetchDevices(authHeader);
                lastDevicesFetchTime = now;
            }

            // Fetch live positions
            fetchPositions(authHeader);

        } catch (Exception e) {
            Log.w(TAG, "Telematics background check failed: " + e.getMessage());
        } finally {
            if (wakeLock != null && wakeLock.isHeld()) {
                try {
                    wakeLock.release();
                } catch (Exception ignored) {}
            }
        }
    }

    private void fetchDevices(String authHeader) {
        try {
            String jsonStr = httpGet("https://track.abstracker.org/api/devices", authHeader);
            if (jsonStr == null) return;

            JSONArray arr = new JSONArray(jsonStr);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject dev = arr.getJSONObject(i);
                int id = dev.optInt("id", -1);
                String name = dev.optString("name", "Vehicle");
                String uniqueId = dev.optString("uniqueId", "");

                JSONObject attrs = dev.optJSONObject("attributes");
                String plate = (attrs != null) ? attrs.optString("plateNumber", "") : "";
                if (plate.isEmpty() && attrs != null) {
                    plate = attrs.optString("vehicleNo", "");
                }

                String bestId = !plate.isEmpty() ? plate : (!name.isEmpty() ? name : uniqueId);
                deviceNames.put(id, bestId);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error fetching devices: " + e.getMessage());
        }
    }

    private void fetchPositions(String authHeader) {
        try {
            String jsonStr = httpGet("https://track.abstracker.org/api/positions", authHeader);
            if (jsonStr == null) return;

            JSONArray arr = new JSONArray(jsonStr);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject pos = arr.getJSONObject(i);
                int devId = pos.optInt("deviceId", -1);
                if (devId <= 0) continue;

                JSONObject attrs = pos.optJSONObject("attributes");
                boolean isIgnOn = false;
                if (attrs != null) {
                    isIgnOn = attrs.optBoolean("ignition", false);
                }
                if (!isIgnOn && pos.has("ignition")) {
                    isIgnOn = pos.optBoolean("ignition", false);
                }

                if (prevIgnitions.containsKey(devId)) {
                    boolean prev = prevIgnitions.get(devId);
                    if (prev != isIgnOn) {
                        // Ignition state changed!
                        String rawName = deviceNames.getOrDefault(devId, "Vehicle");
                        triggerIgnitionAlert(rawName, isIgnOn, devId);
                    }
                }
                prevIgnitions.put(devId, isIgnOn);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error fetching positions: " + e.getMessage());
        }
    }

    private void saveAlertToHistory(JSONObject alertJson) {
        try {
            SharedPreferences prefs = getSharedPreferences("AbsTrackerPrefs", Context.MODE_PRIVATE);
            String existingStr = prefs.getString("background_alerts_history", "[]");
            JSONArray arr = new JSONArray(existingStr);
            arr.put(alertJson);

            // Keep up to 100 recent alerts
            if (arr.length() > 100) {
                JSONArray trimmed = new JSONArray();
                for (int i = arr.length() - 100; i < arr.length(); i++) {
                    trimmed.put(arr.get(i));
                }
                arr = trimmed;
            }
            prefs.edit().putString("background_alerts_history", arr.toString()).apply();
        } catch (Exception e) {
            Log.w(TAG, "Error saving alert history: " + e.getMessage());
        }
    }

    private void triggerIgnitionAlert(String rawName, boolean isIgnOn, int devId) {
        // Format clean vehicle plate and label
        String plate = rawName;
        String label = "";

        // Check if rawName is formatted like "BE25PA0494(UDASNU-THANA)" or "BR01PM2106 (TOWN THANA)"
        int openParen = rawName.indexOf('(');
        int closeParen = rawName.indexOf(')');
        if (openParen > 0 && closeParen > openParen) {
            plate = rawName.substring(0, openParen).trim();
            label = rawName.substring(openParen + 1, closeParen).trim();
        }

        SimpleDateFormat sdf = new SimpleDateFormat("hh:mm a", Locale.getDefault());
        String timeStr = sdf.format(new Date());

        SimpleDateFormat isoFmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        String isoTime = isoFmt.format(new Date());

        String title = "[" + plate + "] " + (isIgnOn ? "Engine ON" : "Engine OFF");
        String body = (label.isEmpty() ? plate : label) + ": Ignition switched " + (isIgnOn ? "ON" : "OFF") + " at " + timeStr + ".";

        Log.i(TAG, "TRIGGERING BACKGROUND ALERT: " + title + " -> " + body);

        // Store into persistent SharedPreferences alert history for WebView
        try {
            JSONObject alertObj = new JSONObject();
            alertObj.put("id", "bg-" + devId + "-" + System.currentTimeMillis());
            alertObj.put("deviceId", devId);
            alertObj.put("vehicleName", rawName);
            alertObj.put("vehiclePlate", plate);
            alertObj.put("category", "car");
            alertObj.put("type", isIgnOn ? "ignitionOn" : "ignitionOff");
            alertObj.put("categoryType", "ignition");
            alertObj.put("title", title);
            alertObj.put("message", body);
            alertObj.put("address", "Live GPS Coordinates");
            alertObj.put("severity", isIgnOn ? "info" : "danger");
            alertObj.put("time", isoTime);
            saveAlertToHistory(alertObj);
        } catch (Exception ignored) {}

        // 1. Spoken voice announcement through speaker
        String spoken = plate + " Engine " + (isIgnOn ? "On" : "Off");
        speakAlert(spoken);

        // 2. High-priority Android notification with sound & vibration
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, devId + (int) System.currentTimeMillis(), openIntent,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
        );

        Uri defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ALERT_ID)
                .setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setSound(defaultSound)
                .setVibrate(new long[]{0, 350, 200, 350})
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setDefaults(Notification.DEFAULT_ALL)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .build();

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            int notifId = (int) (System.currentTimeMillis() % 100000) + devId;
            nm.notify(notifId, notification);
        }
    }

    private String httpGet(String urlStr, String authHeader) {
        HttpURLConnection conn = null;
        BufferedReader reader = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("Authorization", authHeader);
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);

            int code = conn.getResponseCode();
            if (code == 200) {
                reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                return sb.toString();
            }
        } catch (Exception e) {
            // Silently handle connection drops
        } finally {
            if (reader != null) {
                try { reader.close(); } catch (Exception ignored) {}
            }
            if (conn != null) {
                conn.disconnect();
            }
        }
        return null;
    }
}
