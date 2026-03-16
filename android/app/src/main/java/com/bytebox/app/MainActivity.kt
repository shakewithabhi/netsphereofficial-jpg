package com.bytebox.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.bytebox.app.navigation.ByteBoxNavHost
import com.bytebox.core.ui.theme.ByteBoxTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val shareCode = extractShareCode(intent)

        setContent {
            ByteBoxTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    ByteBoxNavHost(deepLinkShareCode = shareCode)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    private fun extractShareCode(intent: Intent?): String? {
        val uri = intent?.data ?: return null
        // Handle http://host/s/{code} or bytebox://share/{code}
        val path = uri.path ?: return null
        if (path.startsWith("/s/")) return path.removePrefix("/s/")
        if (uri.scheme == "bytebox" && uri.host == "share") {
            return uri.pathSegments.firstOrNull()
        }
        return null
    }
}
