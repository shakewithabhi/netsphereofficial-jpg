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
    const val REWARDED_EXTRA_STORAGE = "ca-app-pub-3940256099942544/5224354917"

    private var interstitialAd: InterstitialAd? = null
    private var rewardedAd: RewardedAd? = null

    private val _showAds = MutableStateFlow(true)
    val showAds: StateFlow<Boolean> = _showAds

    fun initialize(context: Context) {
        MobileAds.initialize(context)
    }

    fun setShouldShowAds(show: Boolean) {
        _showAds.value = show
    }

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
}
