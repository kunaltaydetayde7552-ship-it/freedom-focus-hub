package com.freedomclone.app

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class BlockedOverlayActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_blocked_overlay)

        val target = intent.getStringExtra("APP_NAME") ?: intent.getStringExtra("URL_NAME") ?: "This App"
        
        findViewById<TextView>(R.id.textBlockedTitle)?.text = "You've got your freedom back!"
        findViewById<TextView>(R.id.textBlockedNotice)?.text = "🌿 $target is blocked to help you stay focused on what truly matters."
        
        findViewById<Button>(R.id.btnReturnHome)?.setOnClickListener {
            finish()
        }
    }
}
