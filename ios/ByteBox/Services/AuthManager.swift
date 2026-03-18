import Foundation
import SwiftUI

@MainActor
final class AuthManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let api = APIClient.shared

    func checkExistingSession() {
        if api.authToken != nil {
            isAuthenticated = true
            Task {
                await fetchProfile()
            }
        }
    }

    func login(email: String, password: String, serverURL: String?) async {
        isLoading = true
        errorMessage = nil

        if let serverURL = serverURL, !serverURL.isEmpty {
            api.setBaseURL(serverURL)
        }

        do {
            let tokens: AuthTokens = try await api.request(
                "POST",
                path: "/auth/login",
                body: ["email": email, "password": password]
            )
            api.authToken = tokens.accessToken
            api.refreshToken = tokens.refreshToken
            await fetchProfile()
            isAuthenticated = true
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func fetchProfile() async {
        do {
            let user: User = try await api.request("GET", path: "/auth/me")
            currentUser = user
        } catch {
            if case APIError.unauthorized = error {
                logout()
            }
        }
    }

    func logout() {
        api.authToken = nil
        api.refreshToken = nil
        currentUser = nil
        isAuthenticated = false
    }
}
