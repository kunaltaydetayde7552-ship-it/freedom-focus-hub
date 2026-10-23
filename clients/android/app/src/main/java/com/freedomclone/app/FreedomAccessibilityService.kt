package com.freedomclone.app

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Freedom Accessibility Service
 * 1. Monitors active foreground apps and terminates/closes blocked packages.
 * 2. Inspects supported mobile browsers (Chrome, Edge, Firefox) to block URLs.
 */
class FreedomAccessibilityService : AccessibilityService() {

    companion object {
        var isSessionActive: Boolean = false
        var lockedMode: Boolean = false
        var blockedPackages: Set<String> = hashSetOf(
            "com.instagram.android",
            "com.zhiliaoapp.musically", // TikTok
            "com.twitter.android",
            "com.reddit.frontpage",
            "com.google.android.youtube",
            "com.facebook.katana"
        )
        var blockedDomains: Set<String> = hashSetOf(
            "instagram.com", "facebook.com", "tiktok.com", "twitter.com", "x.com", "reddit.com", "youtube.com"
        )
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
            notificationTimeout = 100
        }
        serviceInfo = info
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (!isSessionActive || event == null) return

        val packageName = event.packageName?.toString() ?: return

        // 1. Check if the newly opened app is in the Blocked Packages list
        if (blockedPackages.contains(packageName)) {
            // Intercept app: Go directly to home screen
            performGlobalAction(GLOBAL_ACTION_HOME)

            // Launch the overlay activity explaining the block
            val intent = Intent(this, BlockedOverlayActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("APP_NAME", packageName)
            }
            startActivity(intent)
            return
        }

        // 2. Check Browser URL bar (Chrome, Edge, Firefox, Brave)
        if (isBrowserPackage(packageName)) {
            val rootNode = rootInActiveWindow ?: return
            val currentUrl = findUrlInBrowserNode(rootNode)
            if (currentUrl != null) {
                for (domain in blockedDomains) {
                    if (currentUrl.contains(domain, ignoreCase = true)) {
                        // Press BACK or Home to block browser distraction
                        performGlobalAction(GLOBAL_ACTION_BACK)
                        val intent = Intent(this, BlockedOverlayActivity::class.java).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                            putExtra("URL_NAME", domain)
                        }
                        startActivity(intent)
                        break
                    }
                }
            }
        }
    }

    private fun isBrowserPackage(pkg: String): Boolean {
        return pkg.contains("chrome") || pkg.contains("browser") || pkg.contains("firefox") || pkg.contains("brave")
    }

    private fun findUrlInBrowserNode(node: AccessibilityNodeInfo): String? {
        val viewId = node.viewIdResourceName ?: ""
        if (viewId.contains("url_bar") || viewId.contains("search_box") || viewId.contains("location_bar")) {
            return node.text?.toString()
        }
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            val found = findUrlInBrowserNode(child)
            if (found != null) return found
        }
        return null
    }

    override fun onInterrupt() {}
}
