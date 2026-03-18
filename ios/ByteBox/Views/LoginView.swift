import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager

    @State private var email = ""
    @State private var password = ""
    @State private var serverURL = ""
    @State private var showServerField = false

    private let brandBlue = Color(red: 0.231, green: 0.510, blue: 0.965)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 32) {
                    Spacer().frame(height: 40)

                    // Logo & Title
                    VStack(spacing: 12) {
                        Image(systemName: "cube.box.fill")
                            .font(.system(size: 64))
                            .foregroundStyle(brandBlue)

                        Text("ByteBox")
                            .font(.largeTitle.bold())
                            .foregroundStyle(brandBlue)

                        Text("Your files, anywhere")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    // Form
                    VStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Email")
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundStyle(.secondary)

                            TextField("you@example.com", text: $email)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.never)
                                .padding(12)
                                .background(Color(.systemGray6))
                                .cornerRadius(10)
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            Text("Password")
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundStyle(.secondary)

                            SecureField("Enter your password", text: $password)
                                .textContentType(.password)
                                .padding(12)
                                .background(Color(.systemGray6))
                                .cornerRadius(10)
                        }

                        if showServerField {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("Server URL")
                                    .font(.caption)
                                    .fontWeight(.medium)
                                    .foregroundStyle(.secondary)

                                TextField("https://api.byteboxapp.com", text: $serverURL)
                                    .keyboardType(.URL)
                                    .autocorrectionDisabled()
                                    .textInputAutocapitalization(.never)
                                    .padding(12)
                                    .background(Color(.systemGray6))
                                    .cornerRadius(10)
                            }
                        }

                        if let error = authManager.errorMessage {
                            Text(error)
                                .font(.caption)
                                .foregroundStyle(.red)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal)
                        }

                        Button {
                            Task {
                                await authManager.login(
                                    email: email,
                                    password: password,
                                    serverURL: showServerField ? serverURL : nil
                                )
                            }
                        } label: {
                            Group {
                                if authManager.isLoading {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Text("Sign In")
                                        .fontWeight(.semibold)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding(14)
                            .background(brandBlue)
                            .foregroundStyle(.white)
                            .cornerRadius(10)
                        }
                        .disabled(email.isEmpty || password.isEmpty || authManager.isLoading)
                        .opacity(email.isEmpty || password.isEmpty ? 0.6 : 1)

                        Button {
                            withAnimation {
                                showServerField.toggle()
                            }
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "server.rack")
                                Text(showServerField ? "Hide server settings" : "Self-hosted server?")
                            }
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.horizontal, 24)

                    Spacer()
                }
            }
            .navigationBarHidden(true)
        }
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthManager())
}
