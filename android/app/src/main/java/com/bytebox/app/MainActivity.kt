package com.bytebox.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import com.bytebox.app.navigation.ByteBoxNavHost
import com.bytebox.core.common.AdManager
import com.bytebox.core.datastore.ThemeMode
import com.bytebox.core.datastore.UserPreferences
import com.bytebox.core.ui.theme.ByteBoxTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var userPreferences: UserPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Initialize AdMob and preload all ad types
        AdManager.initialize(this)
        AdManager.loadInterstitial(this)
        AdManager.loadRewarded(this)
        AdManager.loadLaunchAd(this)
        AdManager.loadPreviewAd(this)
        AdManager.loadSpeedBoostAd(this)

        // Show launch interstitial once per session (after a short delay)
        lifecycleScope.launch {
            kotlinx.coroutines.delay(2000)
            AdManager.showLaunchAd(this@MainActivity)
        }

        // Observe user plan to toggle ads (only show for free-tier users)
        lifecycleScope.launch {
            userPreferences.userPlan.collectLatest { plan ->
                AdManager.setShouldShowAds(plan == "free")
            }
        }

        val shareCode = extractShareCode(intent)

        setContent {
            val themeMode by userPreferences.themeMode.collectAsState(initial = ThemeMode.SYSTEM)
            val darkTheme = when (themeMode) {
                ThemeMode.DARK -> true
                ThemeMode.LIGHT -> false
                ThemeMode.SYSTEM -> isSystemInDarkTheme()
            }
            ByteBoxTheme(darkTheme = darkTheme) {
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
