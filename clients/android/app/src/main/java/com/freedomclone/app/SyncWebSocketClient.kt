package com.freedomclone.app

import android.content.Context
import android.os.Build
import android.util.Log
import okhttp3.*
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Handles real-time synchronization between the Android phone and the Freedom Cloud Server.
 */
class SyncWebSocketClient(private val context: Context, private val serverWsUrl: String) {

    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private val deviceId = "android_" + Build.MANUFACTURER.lowercase() + "_" + Build.MODEL.lowercase().replace(" ", "_")
    private val deviceName = "${Build.MANUFACTURER.capitalize()} ${Build.MODEL} (Android Phone)"

    fun connect() {
        val request = Request.Builder().url(serverWsUrl).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                Log.d("FreedomSync", "Connected to Freedom Sync Server")
                // Register Android device
                val regMsg = JSONObject().apply {
                    put("type", "REGISTER_DEVICE")
                    put("deviceId", deviceId)
                    put("name", deviceName)
                    put("platform", "android")
                    put("userId", "default_user_1")
                }
                ws.send(regMsg.toString())
            }

            override fun onMessage(ws: WebSocket, text: String) {
                try {
                    val msg = JSONObject(text)
                    when (msg.getString("type")) {
                        "SESSION_START" -> {
                            val session = msg.getJSONObject("session")
                            val blocklist = msg.getJSONObject("blocklist")
                            val mobileAppsArray = blocklist.getJSONArray("mobileApps")
                            val domainsArray = blocklist.getJSONArray("domains")

                            val newBlockedPackages = mutableSetOf<String>()
                            for (i in 0 until mobileAppsArray.length()) {
                                newBlockedPackages.add(mobileAppsArray.getString(i))
                            }

                            val newBlockedDomains = mutableSetOf<String>()
                            for (i in 0 until domainsArray.length()) {
                                newBlockedDomains.add(domainsArray.getString(i))
                            }

                            FreedomAccessibilityService.blockedPackages = newBlockedPackages
                            FreedomAccessibilityService.blockedDomains = newBlockedDomains
                            FreedomAccessibilityService.lockedMode = session.optInt("locked_mode", 0) == 1
                            FreedomAccessibilityService.isSessionActive = true

                            Log.d("FreedomSync", "SESSION STARTED: ${newBlockedPackages.size} apps blocked.")
                        }
                        "SESSION_END" -> {
                            FreedomAccessibilityService.isSessionActive = false
                            Log.d("FreedomSync", "SESSION ENDED: All blocks lifted.")
                        }
                    }
                } catch (e: Exception) {
                    Log.e("FreedomSync", "Error parsing message: ${e.message}")
                }
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                Log.w("FreedomSync", "WS Failure, reconnecting in 5s: ${t.message}")
                Thread.sleep(5000)
                connect()
            }
        })
    }

    fun disconnect() {
        webSocket?.close(1000, "App closed")
    }
}
