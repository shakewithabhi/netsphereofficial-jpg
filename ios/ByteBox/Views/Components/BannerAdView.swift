import SwiftUI
import GoogleMobileAds

struct BannerAdView: UIViewRepresentable {
    let adUnitID: String

    func makeUIView(context: Context) -> GADBannerView {
        let bannerView = GADBannerView(adSize: GADAdSizeBanner)
        bannerView.adUnitID = adUnitID
        bannerView.rootViewController = UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow?.rootViewController }
            .first
        bannerView.load(GADRequest())
        return bannerView
    }

    func updateUIView(_ uiView: GADBannerView, context: Context) {}
}

struct AdBannerModifier: ViewModifier {
    let adUnitID: String
    @ObservedObject var adManager = AdManager.shared

    func body(content: Content) -> some View {
        VStack(spacing: 0) {
            content
            if adManager.showAds {
                BannerAdView(adUnitID: adUnitID)
                    .frame(height: 50)
            }
        }
    }
}

extension View {
    func withBannerAd(unitID: String) -> some View {
        modifier(AdBannerModifier(adUnitID: unitID))
    }
}
