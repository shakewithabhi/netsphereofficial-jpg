import SwiftUI
import GoogleMobileAds

class AdManager: ObservableObject {
    static let shared = AdManager()

    // Test ad unit IDs - replace with production IDs before release
    static let bannerHome = "ca-app-pub-3940256099942544/2934735716"
    static let bannerFiles = "ca-app-pub-3940256099942544/2934735716"
    static let interstitialDownload = "ca-app-pub-3940256099942544/4411468910"
    static let rewardedExtraStorage = "ca-app-pub-3940256099942544/1712485313"

    @Published var showAds = true
    private var interstitialAd: GADInterstitialAd?
    private var rewardedAd: GADRewardedAd?
    private var downloadCount = 0

    func initialize() {
        GADMobileAds.sharedInstance().start(completionHandler: nil)
        loadInterstitial()
        loadRewarded()
    }

    func updateAdVisibility(plan: String) {
        showAds = (plan == "free" || plan.isEmpty)
    }

    // MARK: - Interstitial Ads

    func loadInterstitial() {
        guard showAds else { return }
        GADInterstitialAd.load(withAdUnitID: Self.interstitialDownload, request: GADRequest()) { [weak self] ad, error in
            if let error = error {
                print("[AdManager] Failed to load interstitial: \(error.localizedDescription)")
                return
            }
            self?.interstitialAd = ad
        }
    }

    func showInterstitialIfReady(from viewController: UIViewController, completion: @escaping () -> Void) {
        guard showAds else { completion(); return }
        downloadCount += 1
        // Show interstitial every 3rd download
        guard downloadCount % 3 == 0, let ad = interstitialAd else {
            completion()
            return
        }
        ad.present(fromRootViewController: viewController)
        loadInterstitial()
        completion()
    }

    // MARK: - Rewarded Ads

    func loadRewarded() {
        guard showAds else { return }
        GADRewardedAd.load(withAdUnitID: Self.rewardedExtraStorage, request: GADRequest()) { [weak self] ad, error in
            if let error = error {
                print("[AdManager] Failed to load rewarded ad: \(error.localizedDescription)")
                return
            }
            self?.rewardedAd = ad
        }
    }

    func showRewarded(from viewController: UIViewController, onRewarded: @escaping () -> Void) {
        guard showAds, let ad = rewardedAd else { return }
        ad.present(fromRootViewController: viewController) {
            onRewarded()
        }
        loadRewarded()
    }

    var isRewardedReady: Bool {
        rewardedAd != nil && showAds
    }
}
