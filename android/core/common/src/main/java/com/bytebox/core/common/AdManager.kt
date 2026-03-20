package com.bytebox.core.common

import android.app.Activity
import android.content.Context
import com.google.android.gms.ads.*
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardItem
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

object AdManager {
    // Test ad unit IDs - replace with real ones in production
    const val BANNER_HOME = "ca-app-pub-3940256099942544/6300978111"
    const val BANNER_FILES = "ca-app-pub-3940256099942544/6300978111"
    const val INTERSTITIAL_DOWNLOAD = "ca-app-pub-3940256099942544/1033173712"
    const val INTERSTITIAL_LAUNCH = "ca-app-pub-3940256099942544/1033173712"
    const val INTERSTITIAL_PREVIEW = "ca-app-pub-3940256099942544/1033173712"
    const val REWARDED_EXTRA_STORAGE = "ca-app-pub-3940256099942544/5224354917"
    const val REWARDED_SPEED_BOOST = "ca-app-pub-3940256099942544/5224354917"
    const val NATIVE_FILE_LIST = "ca-app-pub-3940256099942544/2247696110"
    const val NATIVE_EXPLORE_FEED = "ca-app-pub-3940256099942544/2247696110"

    private var interstitialAd: InterstitialAd? = null
    private var launchAd: InterstitialAd? = null
    private var previewAd: InterstitialAd? = null
    private var rewardedAd: RewardedAd? = null
    private var speedBoostAd: RewardedAd? = null

    private val _showAds = MutableStateFlow(true)
    val showAds: StateFlow<Boolean> = _showAds

    private var hasShownLaunchAd = false
    private var downloadCount = 0

    // Speed boost: 30 min fast download after watching ad
    private var speedBoostExpiresAt: Long = 0L
    val isSpeedBoosted: Boolean get() = System.currentTimeMillis() < speedBoostExpiresAt

    fun initialize(context: Context) {
        MobileAds.initialize(context)
    }

    fun setShouldShowAds(show: Boolean) {
        _showAds.value = show
    }

    // --- App Launch Interstitial (once per session) ---

    fun loadLaunchAd(context: Context) {
        if (!_showAds.value || hasShownLaunchAd) return
        val adRequest = AdRequest.Builder().build()
        InterstitialAd.load(context, INTERSTITIAL_LAUNCH, adRequest,
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) { launchAd = ad }
                override fun onAdFailedToLoad(error: LoadAdError) { launchAd = null }
            })
    }

    fun showLaunchAd(activity: Activity, onDismissed: () -> Unit = {}) {
        if (!_showAds.value || hasShownLaunchAd) { onDismissed(); return }
        hasShownLaunchAd = true
        launchAd?.let { ad ->
            ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                override fun onAdDismissedFullScreenContent() { launchAd = null; onDismissed() }
                override fun onAdFailedToShowFullScreenContent(error: AdError) { onDismissed() }
            }
            ad.show(activity)
        } ?: onDismissed()
    }

    // --- Pre-Preview/Download Interstitial ---

    fun loadPreviewAd(context: Context) {
        if (!_showAds.value) return
        val adRequest = AdRequest.Builder().build()
        InterstitialAd.load(context, INTERSTITIAL_PREVIEW, adRequest,
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) { previewAd = ad }
                override fun onAdFailedToLoad(error: LoadAdError) { previewAd = null }
            })
    }

    fun showPreviewAd(activity: Activity, onDismissed: () -> Unit = {}) {
        if (!_showAds.value) { onDismissed(); return }
        downloadCount++
        // Show ad every 2nd preview/download
        if (downloadCount % 2 != 0) { onDismissed(); return }
        previewAd?.let { ad ->
            ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                override fun onAdDismissedFullScreenContent() {
                    previewAd = null
                    loadPreviewAd(activity)
                    onDismissed()
                }
                override fun onAdFailedToShowFullScreenContent(error: AdError) { onDismissed() }
            }
            ad.show(activity)
        } ?: onDismissed()
    }

    // --- Download Interstitial (every 3rd) ---

    fun loadInterstitial(context: Context) {
        if (!_showAds.value) return
        val adRequest = AdRequest.Builder().build()
        InterstitialAd.load(context, INTERSTITIAL_DOWNLOAD, adRequest,
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) { interstitialAd = ad }
                override fun onAdFailedToLoad(error: LoadAdError) { interstitialAd = null }
            })
    }

    fun showInterstitial(activity: Activity, onDismissed: () -> Unit = {}) {
        if (!_showAds.value) { onDismissed(); return }
        interstitialAd?.let { ad ->
            ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                override fun onAdDismissedFullScreenContent() {
                    interstitialAd = null
                    loadInterstitial(activity)
                    onDismissed()
                }
                override fun onAdFailedToShowFullScreenContent(error: AdError) { onDismissed() }
            }
            ad.show(activity)
        } ?: onDismissed()
    }

    // --- Rewarded: Extra Storage ---

    fun loadRewarded(context: Context) {
        if (!_showAds.value) return
        val adRequest = AdRequest.Builder().build()
        RewardedAd.load(context, REWARDED_EXTRA_STORAGE, adRequest,
            object : RewardedAdLoadCallback() {
                override fun onAdLoaded(ad: RewardedAd) { rewardedAd = ad }
                override fun onAdFailedToLoad(error: LoadAdError) { rewardedAd = null }
            })
    }

    fun showRewarded(activity: Activity, onRewarded: (RewardItem) -> Unit, onDismissed: () -> Unit = {}) {
        if (!_showAds.value) { onDismissed(); return }
        rewardedAd?.let { ad ->
            ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                override fun onAdDismissedFullScreenContent() {
                    rewardedAd = null
                    loadRewarded(activity)
                    onDismissed()
                }
            }
            ad.show(activity) { rewardItem -> onRewarded(rewardItem) }
        } ?: onDismissed()
    }

    fun isRewardedReady(): Boolean = rewardedAd != null && _showAds.value

    // --- Rewarded: Speed Boost (30 min fast download) ---

    fun loadSpeedBoostAd(context: Context) {
        if (!_showAds.value) return
        val adRequest = AdRequest.Builder().build()
        RewardedAd.load(context, REWARDED_SPEED_BOOST, adRequest,
            object : RewardedAdLoadCallback() {
                override fun onAdLoaded(ad: RewardedAd) { speedBoostAd = ad }
                override fun onAdFailedToLoad(error: LoadAdError) { speedBoostAd = null }
            })
    }

    fun showSpeedBoostAd(activity: Activity, onRewarded: () -> Unit, onDismissed: () -> Unit = {}) {
        if (!_showAds.value) { onDismissed(); return }
        speedBoostAd?.let { ad ->
            ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                override fun onAdDismissedFullScreenContent() {
                    speedBoostAd = null
                    loadSpeedBoostAd(activity)
                    onDismissed()
                }
            }
            ad.show(activity) {
                speedBoostExpiresAt = System.currentTimeMillis() + 30 * 60 * 1000L
                onRewarded()
            }
        } ?: onDismissed()
    }

    fun isSpeedBoostAdReady(): Boolean = speedBoostAd != null && _showAds.value

    // --- Native Ad Helpers ---

    /** Returns true if a native ad should be inserted at this position in a list */
    fun shouldShowNativeAd(position: Int, interval: Int = 6): Boolean {
        return _showAds.value && position > 0 && position % interval == 0
    }
}
