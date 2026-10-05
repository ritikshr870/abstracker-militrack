package com.abstracker.tracking;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) || 
            "android.intent.action.QUICKBOOT_POWERON".equals(intent.getAction())) {
            
            SharedPreferences prefs = context.getSharedPreferences("AbsTrackerPrefs", Context.MODE_PRIVATE);
            String authHeader = prefs.getString("auth_header", null);
            
            if (authHeader != null && !authHeader.trim().isEmpty()) {
                Intent serviceIntent = new Intent(context, FleetMonitoringService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            }
        }
    }
}
