import SwiftUI

@main
struct ByteBoxApp: App {
    @StateObject private var authManager = AuthManager()

    var body: some Scene {
        WindowGroup {
            Group {
                if authManager.isAuthenticated {
                    MainTabView()
                        .environmentObject(authManager)
                } else {
                    LoginView()
                        .environmentObject(authManager)
                }
            }
            .animation(.easeInOut, value: authManager.isAuthenticated)
            .onAppear {
                authManager.checkExistingSession()
            }
        }
    }
}
