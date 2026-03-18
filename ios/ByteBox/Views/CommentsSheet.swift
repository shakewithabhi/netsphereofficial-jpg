import SwiftUI

struct CommentsSheet: View {
    let file: FileItem

    @Environment(\.dismiss) private var dismiss
    @State private var comments: [Comment] = []
    @State private var newComment = ""
    @State private var isLoading = false
    @State private var isSending = false
    @State private var errorMessage: String?
    @State private var showError = false

    private let fileService = FileService.shared
    private let brandBlue = Color(red: 0.231, green: 0.510, blue: 0.965)

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Comments List
                if isLoading && comments.isEmpty {
                    Spacer()
                    ProgressView("Loading comments...")
                    Spacer()
                } else if comments.isEmpty {
                    Spacer()
                    VStack(spacing: 12) {
                        Image(systemName: "bubble.left.and.bubble.right")
                            .font(.system(size: 48))
                            .foregroundStyle(.secondary.opacity(0.5))
                        Text("No comments yet")
                            .font(.headline)
                        Text("Be the first to comment")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                } else {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 16) {
                            ForEach(comments) { comment in
                                commentRow(comment)
                            }
                        }
                        .padding()
                    }
                }

                Divider()

                // Comment Input
                HStack(spacing: 12) {
                    TextField("Add a comment...", text: $newComment, axis: .vertical)
                        .textFieldStyle(.plain)
                        .lineLimit(1...4)
                        .padding(10)
                        .background(Color(.systemGray6))
                        .cornerRadius(20)

                    Button {
                        Task { await sendComment() }
                    } label: {
                        Group {
                            if isSending {
                                ProgressView()
                                    .scaleEffect(0.8)
                            } else {
                                Image(systemName: "arrow.up.circle.fill")
                                    .font(.title2)
                            }
                        }
                        .foregroundStyle(newComment.trimmingCharacters(in: .whitespaces).isEmpty ? .secondary : brandBlue)
                    }
                    .disabled(newComment.trimmingCharacters(in: .whitespaces).isEmpty || isSending)
                }
                .padding(.horizontal)
                .padding(.vertical, 10)
                .background(Color(.systemBackground))
            }
            .navigationTitle("Comments")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Done") { dismiss() }
                }
            }
            .task {
                await loadComments()
            }
            .alert("Error", isPresented: $showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "An unknown error occurred")
            }
        }
    }

    private func commentRow(_ comment: Comment) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                // Avatar
                ZStack {
                    Circle()
                        .fill(brandBlue.opacity(0.2))
                        .frame(width: 32, height: 32)

                    Text(String((comment.userDisplayName ?? "U").prefix(1)).uppercased())
                        .font(.caption.bold())
                        .foregroundStyle(brandBlue)
                }

                VStack(alignment: .leading, spacing: 1) {
                    Text(comment.userDisplayName ?? "User")
                        .font(.caption)
                        .fontWeight(.semibold)

                    Text(comment.formattedDate)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Button(role: .destructive) {
                    Task { await deleteComment(comment) }
                } label: {
                    Image(systemName: "trash")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Text(comment.content)
                .font(.body)
                .padding(.leading, 44)
        }
    }

    private func loadComments() async {
        isLoading = true
        do {
            let response = try await fileService.getComments(fileId: file.id)
            comments = response.comments
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
        isLoading = false
    }

    private func sendComment() async {
        let content = newComment.trimmingCharacters(in: .whitespaces)
        guard !content.isEmpty else { return }

        isSending = true
        do {
            let comment = try await fileService.createComment(fileId: file.id, content: content)
            comments.append(comment)
            newComment = ""
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
        isSending = false
    }

    private func deleteComment(_ comment: Comment) async {
        do {
            try await fileService.deleteComment(fileId: file.id, commentId: comment.id)
            comments.removeAll { $0.id == comment.id }
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }
}

#Preview {
    CommentsSheet(file: FileItem(
        id: "1",
        name: "test.jpg",
        mimeType: "image/jpeg",
        size: 1024,
        folderId: nil,
        userId: nil,
        isStarred: false,
        isTrashed: false,
        thumbnailUrl: nil,
        createdAt: nil,
        updatedAt: nil,
        trashedAt: nil
    ))
}
