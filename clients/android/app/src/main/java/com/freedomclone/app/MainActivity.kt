package com.freedomclone.app

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var syncClient: SyncWebSocketClient
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusText = findViewById(R.id.textStatus)
        val btnAccessibility = findViewById<Button>(R.id.btnAccessibility)
        val btnDeviceAdmin = findViewById<Button>(R.id.btnDeviceAdmin)
        val btnVpn = findViewById<Button>(R.id.btnVpn)

        // 1. Accessibility Service Prompt
        btnAccessibility.setOnClickListener {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            startActivity(intent)
        }

        // 2. Device Admin Prompt
        btnDeviceAdmin.setOnClickListener {
            val compName = ComponentName(this, FreedomDeviceAdminReceiver::class.java)
            val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, compName)
                putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Enables Freedom Locked Mode Protection against uninstalling during active focus sessions.")
            }
            startActivity(intent)
        }

        // 3. Prepare Local VPN
        btnVpn.setOnClickListener {
            val vpnIntent = VpnService.prepare(this)
            if (vpnIntent != null) {
                startActivityForResult(vpnIntent, 101)
            } else {
                startService(Intent(this, FreedomVpnService::class.java))
            }
        }

        // Connect to Cloud Sync Server (replace with your server IP/domain)
        val serverUrl = "ws://10.0.2.2:5050/ws" // Local emulator or your local LAN IP
        syncClient = SyncWebSocketClient(this, serverUrl)
        syncClient.connect()
        statusText.text = "Connected to Freedom Hub (Cloud Sync Active)"
    }

    override fun onDestroy() {
        syncClient.disconnect()
        super.onDestroy()
    }
}
