import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var adManager: AdManager
    @State private var cameraBackupEnabled = false
    @State private var showLogoutConfirmation = false
    @State private var showRewardedAlert = false
    @State private var rewardMessage = ""
    @State private var showTwoFactorSetup = false

    private let brandBlue = Color(red: 0.231, green: 0.510, blue: 0.965)

    var body: some View {
        NavigationStack {
            List {
                // Profile Section
                Section {
                    HStack(spacing: 14) {
                        // Avatar
                        ZStack {
                            Circle()
                                .fill(brandBlue.gradient)
                                .frame(width: 56, height: 56)

                            Text(avatarInitials)
                                .font(.title2.bold())
                                .foregroundStyle(.white)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text(authManager.currentUser?.displayName ?? "User")
                                .font(.headline)

                            Text(authManager.currentUser?.email ?? "")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }

                // Storage Section
                Section("Storage") {
                    VStack(alignment: .leading, spacing: 8) {
                        StorageBar(
                            used: authManager.currentUser?.storageUsed ?? 0,
                            limit: authManager.currentUser?.storageLimit ?? 1
                        )

                        HStack {
                            Text("\(authManager.currentUser?.formattedStorageUsed ?? "0 B") used")
                                .font(.caption)
                                .foregroundStyle(.secondary)

                            Spacer()

                            Text("\(authManager.currentUser?.formattedStorageLimit ?? "0 B") total")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }

                // Rewarded Ad Section (free users only)
                if adManager.showAds {
                    Section("Earn Extra Storage") {
                        Button {
                            if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                               let rootVC = windowScene.keyWindow?.rootViewController {
                                adManager.showRewarded(from: rootVC) {
                                    rewardMessage = "You earned 100 MB of extra storage!"
                                    showRewardedAlert = true
                                }
                            }
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "gift.fill")
                                    .foregroundStyle(.orange)
                                Text("Watch Ad for Extra Storage")
                                    .foregroundStyle(.primary)
                                Spacer()
                                if adManager.isRewardedReady {
                                    Image(systemName: "play.circle.fill")
                                        .foregroundStyle(brandBlue)
                                } else {
                                    ProgressView()
                                        .scaleEffect(0.8)
                                }
                            }
                        }
                        .disabled(!adManager.isRewardedReady)
                    }
                }

                // Security Section
                Section("Security") {
                    Button {
                        showTwoFactorSetup = true
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "lock.shield.fill")
                                .foregroundStyle(brandBlue)
                            Text("Two-Factor Authentication")
                                .foregroundStyle(.primary)
                            Spacer()
                            if authManager.currentUser?.twoFactorEnabled == true {
                                Text("On")
                                    .font(.subheadline)
                                    .foregroundStyle(.green)
                            } else {
                                Text("Off")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                // Backup Section
                Section("Backup") {
                    Toggle(isOn: $cameraBackupEnabled) {
                        HStack(spacing: 12) {
                            Image(systemName: "camera.fill")
                                .foregroundStyle(brandBlue)
                            Text("Camera Backup")
                        }
                    }
                    .tint(brandBlue)
                }

                // About Section
                Section("About") {
                    HStack {
                        Image(systemName: "info.circle")
                            .foregroundStyle(brandBlue)
                        Text("Version")
                        Spacer()
                        Text("1.0.0")
                            .foregroundStyle(.secondary)
                    }

                    HStack {
                        Image(systemName: "globe")
                            .foregroundStyle(brandBlue)
                        Text("Server")
                        Spacer()
                        Text(serverHost)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }

                    Link(destination: URL(string: "https://byteboxapp.com")!) {
                        HStack {
                            Image(systemName: "link")
                                .foregroundStyle(brandBlue)
                            Text("Website")
                                .foregroundStyle(.primary)
                            Spacer()
                            Image(systemName: "arrow.up.right.square")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                // Logout Section
                Section {
                    Button(role: .destructive) {
                        showLogoutConfirmation = true
                    } label: {
                        HStack {
                            Spacer()
                            Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Settings")
            .confirmationDialog("Sign Out?", isPresented: $showLogoutConfirmation, titleVisibility: .visible) {
                Button("Sign Out", role: .destructive) {
                    authManager.logout()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("You will need to sign in again to access your files.")
            }
            .alert("Reward Earned!", isPresented: $showRewardedAlert) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(rewardMessage)
            }
            .refreshable {
                await authManager.fetchProfile()
            }
            .sheet(isPresented: $showTwoFactorSetup) {
                TwoFactorSetupView()
                    .environmentObject(authManager)
            }
        }
    }

    private var avatarInitials: String {
        let name = authManager.currentUser?.displayName ?? authManager.currentUser?.email ?? "U"
        let parts = name.split(separator: " ")
        if parts.count >= 2 {
            return "\(parts[0].prefix(1))\(parts[1].prefix(1))".uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }

    private var serverHost: String {
        let url = UserDefaults.standard.string(forKey: "server_url") ?? "https://api.byteboxapp.com"
        return URL(string: url)?.host ?? url
    }
}

#Preview {
    SettingsView()
        .environmentObject(AuthManager())
        .environmentObject(AdManager.shared)
}
