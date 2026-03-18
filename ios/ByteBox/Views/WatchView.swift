import SwiftUI
import AVKit

struct WatchView: View {
    let post: Post
    @ObservedObject var viewModel: ExploreViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var player: AVPlayer?
    @State private var isPlaying = false
    @State private var showReportSheet = false
    @State private var reportReason = ""
    @State private var likeAnimating = false

    private let brandBlue = Color(red: 0.231, green: 0.510, blue: 0.965)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    // Video Player
                    videoPlayer

                    // Content
                    VStack(alignment: .leading, spacing: 16) {
                        // Caption + tags
                        captionSection

                        Divider()

                        // Creator info
                        creatorSection

                        Divider()

                        // Action bar
                        actionBar

                        Divider()

                        // Comments
                        commentsSection

                        // Related videos
                        if !viewModel.relatedPosts.isEmpty {
                            relatedSection
                        }
                    }
                    .padding()
                }
            }
            .background(Color(.systemBackground))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button(role: .destructive) {
                            showReportSheet = true
                        } label: {
                            Label("Report", systemImage: "flag")
                        }

                        Button {
                            UIPasteboard.general.string = "bytebox://explore/\(post.id)"
                        } label: {
                            Label("Copy Link", systemImage: "link")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .alert("Report Video", isPresented: $showReportSheet) {
                TextField("Reason", text: $reportReason)
                Button("Submit", role: .destructive) {
                    Task { await viewModel.reportPost(reason: reportReason) }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Why are you reporting this video?")
            }
            .onAppear {
                loadVideo()
            }
            .onDisappear {
                player?.pause()
            }
        }
    }

    // MARK: - Video Player

    private var videoPlayer: some View {
        Group {
            if let player = player {
                VideoPlayer(player: player)
                    .aspectRatio(16/9, contentMode: .fit)
                    .background(.black)
                    .clipShape(RoundedRectangle(cornerRadius: 0))
            } else {
                Rectangle()
                    .fill(Color.black)
                    .aspectRatio(16/9, contentMode: .fit)
                    .overlay(
                        ProgressView()
                            .tint(.white)
                    )
            }
        }
    }

    // MARK: - Caption

    private var captionSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(post.caption)
                .font(.headline)
                .fontWeight(.semibold)

            if !post.tags.isEmpty {
                FlowLayout(spacing: 6) {
                    ForEach(post.tags, id: \.self) { tag in
                        Text("#\(tag)")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(brandBlue)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(brandBlue.opacity(0.1))
                            .clipShape(Capsule())
                    }
                }
            }

            HStack(spacing: 4) {
                Text("\(post.formattedViews) views")
                Text("·")
                Text(post.relativeTime)
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
    }

    // MARK: - Creator

    private var creatorSection: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [brandBlue, .purple],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 40, height: 40)
                .overlay(
                    Text(String(post.creatorName.prefix(1)).uppercased())
                        .font(.subheadline)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                )

            VStack(alignment: .leading, spacing: 2) {
                Text("@\(post.creatorName)")
                    .font(.subheadline)
                    .fontWeight(.semibold)
            }

            Spacer()

            Button {
                Task { await viewModel.toggleSubscribe() }
            } label: {
                Text(post.isSubscribed ? "Subscribed" : "Subscribe")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 8)
                    .background(
                        post.isSubscribed
                            ? AnyShapeStyle(Color(.systemGray5))
                            : AnyShapeStyle(
                                LinearGradient(
                                    colors: [brandBlue, brandBlue.opacity(0.8)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                    )
                    .foregroundColor(post.isSubscribed ? .primary : .white)
                    .clipShape(Capsule())
            }
        }
    }

    // MARK: - Action Bar

    private var actionBar: some View {
        HStack(spacing: 4) {
            actionButton(
                icon: post.isLiked ? "heart.fill" : "heart",
                label: post.formattedLikes,
                tint: post.isLiked ? .red : .primary
            ) {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) {
                    likeAnimating = true
                }
                Task {
                    await viewModel.toggleLike()
                    likeAnimating = false
                }
            }
            .scaleEffect(likeAnimating ? 1.3 : 1.0)

            actionButton(icon: "eye", label: post.formattedViews, tint: .primary) {}

            actionButton(icon: "bubble.left", label: "\(post.commentCount)", tint: .primary) {}

            actionButton(icon: "square.and.arrow.up", label: "Share", tint: .primary) {
                UIPasteboard.general.string = "bytebox://explore/\(post.id)"
            }
        }
    }

    private func actionButton(icon: String, label: String, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.title3)
                Text(label)
                    .font(.caption2)
            }
            .foregroundColor(tint)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(Color(.systemGray6))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    // MARK: - Comments

    private var commentsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Comments (\(viewModel.comments.count))")
                .font(.headline)
                .fontWeight(.semibold)

            // Comment input
            HStack(spacing: 8) {
                Circle()
                    .fill(brandBlue)
                    .frame(width: 28, height: 28)
                    .overlay(
                        Text("Y")
                            .font(.caption2)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                    )

                TextField("Add a comment...", text: $viewModel.commentText)
                    .textFieldStyle(.plain)
                    .font(.subheadline)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color(.systemGray6))
                    .clipShape(Capsule())

                Button {
                    Task { await viewModel.addComment() }
                } label: {
                    Image(systemName: "paperplane.fill")
                        .foregroundColor(viewModel.commentText.trimmingCharacters(in: .whitespaces).isEmpty ? Color(.systemGray3) : brandBlue)
                }
                .disabled(viewModel.commentText.trimmingCharacters(in: .whitespaces).isEmpty)
            }

            if viewModel.isLoadingComments {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
                .padding(.vertical, 20)
            } else if viewModel.comments.isEmpty {
                Text("No comments yet. Be the first!")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
            } else {
                ForEach(viewModel.comments) { comment in
                    CommentRowView(comment: comment) {
                        Task { await viewModel.deleteComment(comment) }
                    }
                }
            }
        }
    }

    // MARK: - Related

    private var relatedSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Divider()

            Text("Related Videos")
                .font(.headline)
                .fontWeight(.semibold)

            ForEach(viewModel.relatedPosts) { related in
                RelatedVideoRow(post: related)
                    .onTapGesture {
                        viewModel.selectPost(related)
                        dismiss()
                    }
            }
        }
    }

    // MARK: - Helpers

    private func loadVideo() {
        Task {
            do {
                let url = try await FileService.shared.getDownloadURL(fileId: post.fileId)
                if let videoURL = URL(string: url.url) {
                    player = AVPlayer(url: videoURL)
                    player?.play()
                }
            } catch {
                // Ignore
            }
        }
    }
}

// MARK: - Comment Row

struct CommentRowView: View {
    let comment: PostComment
    let onDelete: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [.purple, .pink],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 28, height: 28)
                .overlay(
                    Text(String(comment.userName.prefix(1)).uppercased())
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                )

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text("@\(comment.userName)")
                        .font(.caption)
                        .fontWeight(.semibold)
                    Text(comment.relativeTime)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                Text(comment.content)
                    .font(.subheadline)
                    .foregroundColor(.primary)
            }

            Spacer()

            Button(action: onDelete) {
                Image(systemName: "trash")
                    .font(.caption2)
                    .foregroundColor(Color(.systemGray3))
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Related Video Row

struct RelatedVideoRow: View {
    let post: Post

    var body: some View {
        HStack(spacing: 12) {
            ZStack(alignment: .bottomTrailing) {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color(.systemGray5))
                    .frame(width: 140, height: 80)
                    .overlay(
                        Image(systemName: "play.fill")
                            .foregroundColor(Color(.systemGray3))
                    )

                Text(post.formattedDuration)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundColor(.white)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 2)
                    .background(.black.opacity(0.75))
                    .clipShape(RoundedRectangle(cornerRadius: 3))
                    .padding(4)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(post.caption)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .lineLimit(2)

                Text("@\(post.creatorName)")
                    .font(.caption2)
                    .foregroundColor(.secondary)

                Text("\(post.formattedViews) views")
                    .font(.caption2)
                    .foregroundColor(Color(.tertiaryLabel))
            }

            Spacer()
        }
    }
}

// MARK: - Flow Layout

struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var height: CGFloat = 0
        var lineWidth: CGFloat = 0
        var lineHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if lineWidth + size.width > maxWidth && lineWidth > 0 {
                height += lineHeight + spacing
                lineWidth = 0
                lineHeight = 0
            }
            lineWidth += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
        height += lineHeight

        return CGSize(width: maxWidth, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var lineHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX && x > bounds.minX {
                x = bounds.minX
                y += lineHeight + spacing
                lineHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: .unspecified)
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}

#Preview {
    WatchView(
        post: Post(
            id: "1", fileId: "f1", userId: "u1",
            caption: "Sample video post", category: "Music",
            tags: ["music", "chill"], thumbnailUrl: nil, videoUrl: nil,
            durationSeconds: 204, viewCount: 15200, likeCount: 2300,
            commentCount: 23, createdAt: "2026-03-18T10:00:00Z",
            updatedAt: "2026-03-18T10:00:00Z", creatorName: "johndoe",
            creatorAvatar: nil, isLiked: false, isSubscribed: false
        ),
        viewModel: ExploreViewModel()
    )
}
