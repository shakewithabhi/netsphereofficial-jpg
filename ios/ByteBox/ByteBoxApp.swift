import SwiftUI
import GoogleMobileAds

@main
struct ByteBoxApp: App {
    @StateObject private var authManager = AuthManager()
    @StateObject private var adManager = AdManager.shared

    var body: some Scene {
        WindowGroup {
            Group {
                if authManager.isAuthenticated {
                    MainTabView()
                        .environmentObject(authManager)
                        .environmentObject(adManager)
                } else {
                    LoginView()
                        .environmentObject(authManager)
                }
            }
            .animation(.easeInOut, value: authManager.isAuthenticated)
            .onAppear {
                authManager.checkExistingSession()
                adManager.initialize()
            }
            .onChange(of: authManager.currentUser?.plan) { newPlan in
                adManager.updateAdVisibility(plan: newPlan ?? "free")
            }
        }
    }
}
