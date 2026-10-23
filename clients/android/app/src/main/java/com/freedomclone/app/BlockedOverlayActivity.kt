package com.freedomclone.app

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class BlockedOverlayActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_blocked_overlay)

        val targetApp = intent.getStringExtra("APP_NAME") ?: intent.getStringExtra("URL_NAME") ?: "This distraction"
        findViewById<TextView>(R.id.textBlockedNotice).text = "🌿 Freedom: $targetApp is blocked!"
        findViewById<Button>(R.id.btnReturnHome).setOnClickListener {
            finish()
        }
    }
}
