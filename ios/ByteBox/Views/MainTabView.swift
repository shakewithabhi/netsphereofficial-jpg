import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var authManager: AuthManager

    private let brandBlue = Color(red: 0.231, green: 0.510, blue: 0.965)

    var body: some View {
        TabView {
            FilesView()
                .tabItem {
                    Label("Home", systemImage: "house.fill")
                }

            FavoritesView()
                .tabItem {
                    Label("Favorites", systemImage: "star.fill")
                }

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
    }
}

#Preview {
    MainTabView()
        .environmentObject(AuthManager())
}
