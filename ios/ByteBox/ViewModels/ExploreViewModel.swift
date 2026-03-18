import Foundation
import SwiftUI

enum ExploreTab: String, CaseIterable {
    case forYou = "For You"
    case trending = "Trending"
    case subscriptions = "Subscriptions"
}

let exploreCategories = ["All", "Music", "Gaming", "Education", "Sports", "Entertainment", "Technology", "Travel", "Food", "Art", "Science", "News"]

@MainActor
final class ExploreViewModel: ObservableObject {
    @Published var activeTab: ExploreTab = .forYou
    @Published var activeCategory: String = "All"
    @Published var trendingPosts: [Post] = []
    @Published var feedPosts: [Post] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var showError = false

    // Search
    @Published var searchText = ""
    @Published var isSearching = false
    @Published var searchResults: [Post] = []

    // Watch
    @Published var selectedPost: Post?
    @Published var relatedPosts: [Post] = []
    @Published var comments: [PostComment] = []
    @Published var isLoadingComments = false
    @Published var commentText = ""

    private let fileService = FileService.shared

    // MARK: - Load Content

    func loadContent() async {
        isLoading = true
        errorMessage = nil

        do {
            // Load trending
            trendingPosts = try await fileService.getTrendingFeed(limit: 10)

            // Load main feed
            switch activeTab {
            case .forYou:
                feedPosts = try await fileService.getForYouFeed(limit: 20)
            case .trending:
                feedPosts = try await fileService.getTrendingFeed(limit: 20)
            case .subscriptions:
                feedPosts = try await fileService.getSubscriptionFeed(limit: 20)
            }

            // Filter by category
            if activeCategory != "All" {
                feedPosts = feedPosts.filter { $0.category == activeCategory }
            }
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }

        isLoading = false
    }

    // MARK: - Search

    func search() async {
        let query = searchText.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else {
            isSearching = false
            searchResults = []
            return
        }

        isSearching = true
        do {
            searchResults = try await fileService.searchExplorePosts(query: query)
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    func clearSearch() {
        searchText = ""
        isSearching = false
        searchResults = []
    }

    // MARK: - Watch

    func selectPost(_ post: Post) {
        selectedPost = post
        Task {
            await loadPostDetails(post)
        }
    }

    func loadPostDetails(_ post: Post) async {
        isLoadingComments = true
        do {
            async let relatedTask = fileService.getRelatedPosts(postId: post.id)
            async let commentsTask = fileService.getPostComments(postId: post.id)
            relatedPosts = try await relatedTask
            comments = try await commentsTask
        } catch {
            // Ignore - non-critical
        }
        isLoadingComments = false

        // Record view after 3 seconds
        try? await Task.sleep(nanoseconds: 3_000_000_000)
        try? await fileService.recordPostView(postId: post.id, durationSeconds: 3)
    }

    // MARK: - Engagement

    func toggleLike() async {
        guard var post = selectedPost else { return }
        do {
            if post.isLiked {
                try await fileService.unlikePost(postId: post.id)
            } else {
                try await fileService.likePost(postId: post.id)
            }
            // Refresh the post
            let updated = try await fileService.getExplorePost(postId: post.id)
            selectedPost = updated
            if let idx = feedPosts.firstIndex(where: { $0.id == updated.id }) {
                feedPosts[idx] = updated
            }
            if let idx = trendingPosts.firstIndex(where: { $0.id == updated.id }) {
                trendingPosts[idx] = updated
            }
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    func toggleSubscribe() async {
        guard let post = selectedPost else { return }
        do {
            if post.isSubscribed {
                try await fileService.unsubscribeFromCreator(userId: post.userId)
            } else {
                try await fileService.subscribeToCreator(userId: post.userId)
            }
            let updated = try await fileService.getExplorePost(postId: post.id)
            selectedPost = updated
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    func addComment() async {
        let text = commentText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty, let post = selectedPost else { return }
        do {
            let comment = try await fileService.addPostComment(postId: post.id, content: text)
            comments.insert(comment, at: 0)
            commentText = ""
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    func deleteComment(_ comment: PostComment) async {
        guard let post = selectedPost else { return }
        do {
            try await fileService.deletePostComment(postId: post.id, commentId: comment.id)
            comments.removeAll { $0.id == comment.id }
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    func reportPost(reason: String) async {
        guard let post = selectedPost else { return }
        do {
            try await fileService.reportPost(postId: post.id, reason: reason)
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }
}
