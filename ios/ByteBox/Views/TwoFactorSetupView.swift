import SwiftUI

struct TwoFactorSetupView: View {
    @EnvironmentObject var authManager: AuthManager
    @Environment(\.dismiss) private var dismiss

    @State private var secret = ""
    @State private var qrURL = ""
    @State private var verificationCode = ""
    @State private var backupCodes: [String] = []
    @State private var isEnabling = false
    @State private var isVerifying = false
    @State private var isDisabling = false
    @State private var disableCode = ""
    @State private var showDisableConfirm = false
    @State private var showBackupCodes = false
    @State private var errorMessage: String?

    private let brandBlue = Color(red: 0.231, green: 0.510, blue: 0.965)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    if authManager.currentUser?.twoFactorEnabled == true {
                        disableSection
                    } else if showBackupCodes {
                        backupCodesSection
                    } else if !secret.isEmpty {
                        setupSection
                    } else {
                        enableSection
                    }
                }
                .padding(24)
            }
            .navigationTitle("Two-Factor Auth")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
        }
    }

    // MARK: - Enable Section (initial state)

    private var enableSection: some View {
        VStack(spacing: 20) {
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 56))
                .foregroundStyle(brandBlue)

            Text("Add an Extra Layer of Security")
                .font(.title3.bold())
                .multilineTextAlignment(.center)

            Text("Two-factor authentication adds a second step to your login process using an authenticator app like Google Authenticator or Authy.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            if let error = errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }

            Button {
                Task {
                    await enableTwoFactor()
                }
            } label: {
                Group {
                    if isEnabling {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text("Enable 2FA")
                            .fontWeight(.semibold)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(14)
                .background(brandBlue)
                .foregroundStyle(.white)
                .cornerRadius(10)
            }
            .disabled(isEnabling)
        }
    }

    // MARK: - Setup Section (QR code + verify)

    private var setupSection: some View {
        VStack(spacing: 20) {
            Text("Scan QR Code")
                .font(.title3.bold())

            Text("Scan this QR code with your authenticator app:")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            // QR code placeholder (load from URL)
            if !qrURL.isEmpty, let url = URL(string: qrURL) {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 200, height: 200)
                } placeholder: {
                    ProgressView()
                        .frame(width: 200, height: 200)
                }
                .background(Color.white)
                .cornerRadius(12)
            }

            // Manual entry
            VStack(spacing: 8) {
                Text("Or enter this key manually:")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                HStack {
                    Text(secret)
                        .font(.system(.body, design: .monospaced))
                        .textSelection(.enabled)

                    Button {
                        UIPasteboard.general.string = secret
                    } label: {
                        Image(systemName: "doc.on.doc")
                            .font(.caption)
                    }
                }
                .padding(12)
                .background(Color(.systemGray6))
                .cornerRadius(8)
            }

            Divider()

            // Verification code input
            VStack(alignment: .leading, spacing: 6) {
                Text("Verification Code")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(.secondary)

                TextField("Enter 6-digit code", text: $verificationCode)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .font(.system(.title2, design: .monospaced))
                    .multilineTextAlignment(.center)
                    .padding(12)
                    .background(Color(.systemGray6))
                    .cornerRadius(10)
                    .onChange(of: verificationCode) { newValue in
                        verificationCode = String(newValue.prefix(6)).filter { $0.isNumber }
                    }
            }

            if let error = errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }

            Button {
                Task {
                    await verifyTwoFactor()
                }
            } label: {
                Group {
                    if isVerifying {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text("Verify & Enable")
                            .fontWeight(.semibold)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(14)
                .background(brandBlue)
                .foregroundStyle(.white)
                .cornerRadius(10)
            }
            .disabled(verificationCode.count != 6 || isVerifying)
            .opacity(verificationCode.count != 6 ? 0.6 : 1)
        }
    }

    // MARK: - Backup Codes Section

    private var backupCodesSection: some View {
        VStack(spacing: 20) {
            Image(systemName: "checkmark.shield.fill")
                .font(.system(size: 56))
                .foregroundStyle(.green)

            Text("2FA Enabled Successfully!")
                .font(.title3.bold())

            Text("Save these backup codes in a safe place. You can use each code once if you lose access to your authenticator app.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            VStack(spacing: 8) {
                ForEach(backupCodes, id: \.self) { code in
                    Text(code)
                        .font(.system(.body, design: .monospaced))
                        .frame(maxWidth: .infinity)
                        .padding(8)
                        .background(Color(.systemGray6))
                        .cornerRadius(6)
                }
            }

            Button {
                let codesText = backupCodes.joined(separator: "\n")
                UIPasteboard.general.string = codesText
            } label: {
                HStack {
                    Image(systemName: "doc.on.doc")
                    Text("Copy All Codes")
                }
                .frame(maxWidth: .infinity)
                .padding(14)
                .background(Color(.systemGray6))
                .foregroundStyle(brandBlue)
                .cornerRadius(10)
            }

            Button {
                dismiss()
            } label: {
                Text("Done")
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
                    .padding(14)
                    .background(brandBlue)
                    .foregroundStyle(.white)
                    .cornerRadius(10)
            }
        }
    }

    // MARK: - Disable Section

    private var disableSection: some View {
        VStack(spacing: 20) {
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 56))
                .foregroundStyle(.green)

            Text("2FA is Enabled")
                .font(.title3.bold())

            Text("Your account is protected with two-factor authentication.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Divider()

            VStack(alignment: .leading, spacing: 6) {
                Text("Enter your 2FA code to disable")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(.secondary)

                TextField("Enter 6-digit code", text: $disableCode)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .font(.system(.title2, design: .monospaced))
                    .multilineTextAlignment(.center)
                    .padding(12)
                    .background(Color(.systemGray6))
                    .cornerRadius(10)
                    .onChange(of: disableCode) { newValue in
                        disableCode = String(newValue.prefix(6)).filter { $0.isNumber }
                    }
            }

            if let error = errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }

            Button(role: .destructive) {
                showDisableConfirm = true
            } label: {
                Group {
                    if isDisabling {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text("Disable 2FA")
                            .fontWeight(.semibold)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(14)
                .background(Color.red)
                .foregroundStyle(.white)
                .cornerRadius(10)
            }
            .disabled(disableCode.count != 6 || isDisabling)
            .opacity(disableCode.count != 6 ? 0.6 : 1)
            .confirmationDialog("Disable Two-Factor Authentication?", isPresented: $showDisableConfirm, titleVisibility: .visible) {
                Button("Disable 2FA", role: .destructive) {
                    Task {
                        await disableTwoFactor()
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This will remove the extra security from your account.")
            }
        }
    }

    // MARK: - Actions

    private func enableTwoFactor() async {
        isEnabling = true
        errorMessage = nil

        do {
            let result = try await authManager.enable2FA()
            secret = result.secret
            qrURL = result.qrURL
        } catch {
            errorMessage = error.localizedDescription
        }

        isEnabling = false
    }

    private func verifyTwoFactor() async {
        isVerifying = true
        errorMessage = nil

        do {
            backupCodes = try await authManager.verify2FA(code: verificationCode)
            showBackupCodes = true
            await authManager.fetchProfile()
        } catch {
            errorMessage = error.localizedDescription
        }

        isVerifying = false
    }

    private func disableTwoFactor() async {
        isDisabling = true
        errorMessage = nil

        do {
            try await authManager.disable2FA(code: disableCode)
            await authManager.fetchProfile()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }

        isDisabling = false
    }
}

#Preview {
    TwoFactorSetupView()
        .environmentObject(AuthManager())
}
