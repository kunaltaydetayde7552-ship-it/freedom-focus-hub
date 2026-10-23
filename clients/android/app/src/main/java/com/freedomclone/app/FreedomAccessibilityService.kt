package com.freedomclone.app

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Freedom High-Strictness Accessibility Service
 * 1. Detects distracting foreground apps (YouTube, Instagram, TikTok) instantly.
 * 2. Force-closes them to home screen and brings up the signature Green Screen Overlay.
 * 3. Inspects browser URL bars (Chrome, Edge, Brave, Firefox) to block websites.
 */
class FreedomAccessibilityService : AccessibilityService() {

    companion object {
        var isSessionActive: Boolean = false
        var lockedMode: Boolean = false
        var blockedPackages: Set<String> = hashSetOf(
            "com.google.android.youtube",
            "com.instagram.android",
            "com.zhiliaoapp.musically", // TikTok
            "com.twitter.android",
            "com.reddit.frontpage",
            "com.facebook.katana",
            "com.netflix.mediaclient"
        )
        var blockedDomains: Set<String> = hashSetOf(
            "youtube.com", "youtu.be", "m.youtube.com", "instagram.com", "facebook.com",
            "tiktok.com", "twitter.com", "x.com", "reddit.com", "netflix.com"
        )
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS or AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
            notificationTimeout = 50 // Ultra-fast 50ms reaction
        }
        serviceInfo = info
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (!isSessionActive || event == null) return

        val packageName = event.packageName?.toString() ?: return

        // 1. Strict App Interception
        if (blockedPackages.contains(packageName)) {
            // Force return to Home Screen immediately
            performGlobalAction(GLOBAL_ACTION_HOME)

            // Launch signature Fullscreen Green Screen Overlay
            val intent = Intent(this, BlockedOverlayActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NO_ANIMATION
                putExtra("APP_NAME", getFriendlyAppName(packageName))
            }
            startActivity(intent)
            return
        }

        // 2. Strict Browser URL Interception
        if (isBrowserPackage(packageName)) {
            val rootNode = rootInActiveWindow ?: return
            val currentUrl = findUrlInBrowserNode(rootNode)
            if (currentUrl != null) {
                for (domain in blockedDomains) {
                    if (currentUrl.contains(domain, ignoreCase = true)) {
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

    private fun getFriendlyAppName(pkg: String): String {
        return when {
            pkg.contains("youtube") -> "YouTube"
            pkg.contains("instagram") -> "Instagram"
            pkg.contains("zhiliaoapp") || pkg.contains("tiktok") -> "TikTok"
            pkg.contains("twitter") -> "X (Twitter)"
            pkg.contains("facebook") -> "Facebook"
            pkg.contains("reddit") -> "Reddit"
            pkg.contains("netflix") -> "Netflix"
            else -> pkg
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
