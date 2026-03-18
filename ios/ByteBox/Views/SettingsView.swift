import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var cameraBackupEnabled = false
    @State private var showLogoutConfirmation = false

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
            .refreshable {
                await authManager.fetchProfile()
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
}
