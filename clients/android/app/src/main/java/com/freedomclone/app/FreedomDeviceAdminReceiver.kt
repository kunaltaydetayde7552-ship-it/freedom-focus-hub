package com.freedomclone.app

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast

/**
 * Device Administrator Receiver
 * Protects Freedom from being uninstalled during active Locked Mode sessions.
 */
class FreedomDeviceAdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Toast.makeText(context, "Freedom Guardian Admin Protection Enabled", Toast.LENGTH_SHORT).show()
    }

    override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
        if (FreedomAccessibilityService.isSessionActive && FreedomAccessibilityService.lockedMode) {
            return "⚠️ LOCKED MODE ACTIVE: You cannot disable Freedom or uninstall it until your focus session ends!"
        }
        return "Are you sure you want to disable Freedom device administration?"
    }
}
