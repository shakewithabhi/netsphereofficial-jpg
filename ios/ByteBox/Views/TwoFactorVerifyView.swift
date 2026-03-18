import SwiftUI

struct TwoFactorVerifyView: View {
    @EnvironmentObject var authManager: AuthManager
    @Environment(\.dismiss) private var dismiss

    let tempToken: String

    @State private var code = ""
    @State private var isVerifying = false
    @State private var errorMessage: String?
    @FocusState private var isCodeFocused: Bool

    private let brandBlue = Color(red: 0.231, green: 0.510, blue: 0.965)

    var body: some View {
        NavigationStack {
            VStack(spacing: 32) {
                Spacer()

                // Icon
                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(brandBlue)

                // Title
                VStack(spacing: 8) {
                    Text("Two-Factor Verification")
                        .font(.title2.bold())

                    Text("Enter the 6-digit code from your authenticator app")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }

                // Code input
                TextField("000000", text: $code)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .font(.system(size: 36, weight: .semibold, design: .monospaced))
                    .multilineTextAlignment(.center)
                    .padding(16)
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
                    .padding(.horizontal, 48)
                    .focused($isCodeFocused)
                    .onChange(of: code) { newValue in
                        code = String(newValue.prefix(6)).filter { $0.isNumber }
                    }

                // Error message
                if let error = errorMessage {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }

                // Verify button
                Button {
                    Task {
                        await verify()
                    }
                } label: {
                    Group {
                        if isVerifying {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text("Verify")
                                .fontWeight(.semibold)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(14)
                    .background(brandBlue)
                    .foregroundStyle(.white)
                    .cornerRadius(10)
                }
                .padding(.horizontal, 24)
                .disabled(code.count != 6 || isVerifying)
                .opacity(code.count != 6 ? 0.6 : 1)

                Spacer()
                Spacer()
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                isCodeFocused = true
            }
        }
    }

    private func verify() async {
        isVerifying = true
        errorMessage = nil

        do {
            try await authManager.verify2FALogin(code: code, tempToken: tempToken)
        } catch {
            errorMessage = error.localizedDescription
        }

        isVerifying = false
    }
}

#Preview {
    TwoFactorVerifyView(tempToken: "test-token")
        .environmentObject(AuthManager())
}
