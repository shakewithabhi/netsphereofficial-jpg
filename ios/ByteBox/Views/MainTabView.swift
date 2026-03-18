import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var adManager: AdManager
    @StateObject private var notificationsViewModel = NotificationsViewModel()

    private let brandBlue = Color(red: 0.231, green: 0.510, blue: 0.965)

    var body: some View {
        VStack(spacing: 0) {
            TabView {
                FilesView()
                    .tabItem {
                        Label("Home", systemImage: "house.fill")
                    }

                ExploreView()
                    .tabItem {
                        Label("Explore", systemImage: "play.rectangle.fill")
                    }

                FavoritesView()
                    .tabItem {
                        Label("Favorites", systemImage: "star.fill")
                    }

                NotificationsView()
                    .tabItem {
                        Label("Notifications", systemImage: "bell.fill")
                    }
                    .badge(notificationsViewModel.unreadCount)

                TrashView()
                    .tabItem {
                        Label("Trash", systemImage: "trash.fill")
                    }

                SettingsView()
                    .tabItem {
                        Label("Settings", systemImage: "gearshape.fill")
                    }
            }
            .tint(brandBlue)

            // Banner ad at bottom for free-tier users
            if adManager.showAds {
                BannerAdView(adUnitID: AdManager.bannerHome)
                    .frame(height: 50)
                    .background(Color(.systemBackground))
            }
        }
        .task {
            await notificationsViewModel.loadUnreadCount()
        }
    }
}

#Preview {
    MainTabView()
        .environmentObject(AuthManager())
        .environmentObject(AdManager.shared)
}
