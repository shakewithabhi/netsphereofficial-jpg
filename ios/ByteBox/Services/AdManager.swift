import SwiftUI
import GoogleMobileAds

class AdManager: ObservableObject {
    static let shared = AdManager()

    // Test ad unit IDs - replace with production IDs before release
    static let bannerHome = "ca-app-pub-3940256099942544/2934735716"
    static let bannerFiles = "ca-app-pub-3940256099942544/2934735716"
    static let interstitialDownload = "ca-app-pub-3940256099942544/4411468910"
    static let interstitialLaunch = "ca-app-pub-3940256099942544/4411468910"
    static let interstitialPreview = "ca-app-pub-3940256099942544/4411468910"
    static let rewardedExtraStorage = "ca-app-pub-3940256099942544/1712485313"
    static let rewardedSpeedBoost = "ca-app-pub-3940256099942544/1712485313"
    static let nativeFileList = "ca-app-pub-3940256099942544/3986624511"
    static let nativeExploreFeed = "ca-app-pub-3940256099942544/3986624511"

    @Published var showAds = true
    @Published var isSpeedBoosted = false

    private var interstitialAd: GADInterstitialAd?
    private var launchAd: GADInterstitialAd?
    private var previewAd: GADInterstitialAd?
    private var rewardedAd: GADRewardedAd?
    private var speedBoostAd: GADRewardedAd?
    private var downloadCount = 0
    private var hasShownLaunchAd = false
    private var speedBoostTimer: Timer?

    func initialize() {
        GADMobileAds.sharedInstance().start(completionHandler: nil)
        loadInterstitial()
        loadRewarded()
        loadLaunchAd()
        loadPreviewAd()
        loadSpeedBoostAd()
    }

    func updateAdVisibility(plan: String) {
        showAds = (plan == "free" || plan.isEmpty)
    }

    // MARK: - App Launch Interstitial (once per session)

    func loadLaunchAd() {
        guard showAds, !hasShownLaunchAd else { return }
        GADInterstitialAd.load(withAdUnitID: Self.interstitialLaunch, request: GADRequest()) { [weak self] ad, _ in
            self?.launchAd = ad
        }
    }

    func showLaunchAd(from viewController: UIViewController) {
        guard showAds, !hasShownLaunchAd, let ad = launchAd else { return }
        hasShownLaunchAd = true
        ad.present(fromRootViewController: viewController)
    }

    // MARK: - Pre-Preview/Download Interstitial (every 2nd)

    func loadPreviewAd() {
        guard showAds else { return }
        GADInterstitialAd.load(withAdUnitID: Self.interstitialPreview, request: GADRequest()) { [weak self] ad, _ in
            self?.previewAd = ad
        }
    }

    func showPreviewAd(from viewController: UIViewController, completion: @escaping () -> Void) {
        guard showAds else { completion(); return }
        downloadCount += 1
        guard downloadCount % 2 == 0, let ad = previewAd else { completion(); return }
        ad.present(fromRootViewController: viewController)
        loadPreviewAd()
        completion()
    }

    // MARK: - Download Interstitial (every 3rd)

    func loadInterstitial() {
        guard showAds else { return }
        GADInterstitialAd.load(withAdUnitID: Self.interstitialDownload, request: GADRequest()) { [weak self] ad, _ in
            self?.interstitialAd = ad
        }
    }

    func showInterstitialIfReady(from viewController: UIViewController, completion: @escaping () -> Void) {
        guard showAds, let ad = interstitialAd else { completion(); return }
        ad.present(fromRootViewController: viewController)
        loadInterstitial()
        completion()
    }

    // MARK: - Rewarded: Extra Storage

    func loadRewarded() {
        guard showAds else { return }
        GADRewardedAd.load(withAdUnitID: Self.rewardedExtraStorage, request: GADRequest()) { [weak self] ad, _ in
            self?.rewardedAd = ad
        }
    }

    func showRewarded(from viewController: UIViewController, onRewarded: @escaping () -> Void) {
        guard showAds, let ad = rewardedAd else { return }
        ad.present(fromRootViewController: viewController) { onRewarded() }
        loadRewarded()
    }

    var isRewardedReady: Bool { rewardedAd != nil && showAds }

    // MARK: - Rewarded: Speed Boost (30 min fast download)

    func loadSpeedBoostAd() {
        guard showAds else { return }
        GADRewardedAd.load(withAdUnitID: Self.rewardedSpeedBoost, request: GADRequest()) { [weak self] ad, _ in
            self?.speedBoostAd = ad
        }
    }

    func showSpeedBoostAd(from viewController: UIViewController, onRewarded: @escaping () -> Void) {
        guard showAds, let ad = speedBoostAd else { return }
        ad.present(fromRootViewController: viewController) { [weak self] in
            self?.isSpeedBoosted = true
            self?.speedBoostTimer?.invalidate()
            self?.speedBoostTimer = Timer.scheduledTimer(withTimeInterval: 30 * 60, repeats: false) { _ in
                DispatchQueue.main.async { self?.isSpeedBoosted = false }
            }
            onRewarded()
        }
        loadSpeedBoostAd()
    }

    var isSpeedBoostAdReady: Bool { speedBoostAd != nil && showAds }

    // MARK: - Native Ad Helpers

    func shouldShowNativeAd(at position: Int, interval: Int = 6) -> Bool {
        showAds && position > 0 && position % interval == 0
    }
}
