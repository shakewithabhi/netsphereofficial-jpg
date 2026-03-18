import Foundation
import SwiftUI

@MainActor
final class AuthManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var requires2FA = false
    @Published var tempToken: String?

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

            if tokens.requires2FA == true, let temp = tokens.tempToken {
                // 2FA required - show verification sheet
                tempToken = temp
                requires2FA = true
            } else if let accessToken = tokens.accessToken {
                api.authToken = accessToken
                api.refreshToken = tokens.refreshToken
                await fetchProfile()
                isAuthenticated = true
            }
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
        requires2FA = false
        tempToken = nil
    }

    // MARK: - Two-Factor Authentication

    func enable2FA() async throws -> (secret: String, qrURL: String) {
        let response: TwoFactorSetupResponse = try await api.request(
            "POST",
            path: "/auth/2fa/enable"
        )
        return (secret: response.secret, qrURL: response.qrUrl)
    }

    func verify2FA(code: String) async throws -> [String] {
        let response: TwoFactorVerifyResponse = try await api.request(
            "POST",
            path: "/auth/2fa/verify",
            body: ["code": code]
        )
        return response.backupCodes
    }

    func disable2FA(code: String) async throws {
        let _: EmptyResponse = try await api.request(
            "POST",
            path: "/auth/2fa/disable",
            body: ["code": code]
        )
    }

    func verify2FALogin(code: String, tempToken: String) async throws {
        let response: TwoFactorLoginResponse = try await api.request(
            "POST",
            path: "/auth/2fa/login",
            body: ["code": code, "temp_token": tempToken]
        )
        api.authToken = response.accessToken
        if let rt = response.refreshToken {
            api.refreshToken = rt
        }
        await fetchProfile()
        self.requires2FA = false
        self.tempToken = nil
        isAuthenticated = true
    }
}
