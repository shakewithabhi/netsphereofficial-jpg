import SwiftUI

struct ExploreView: View {
    @StateObject private var viewModel = ExploreViewModel()
    @State private var showCreatePost = false

    private let brandBlue = Color(red: 0.231, green: 0.510, blue: 0.965)
    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    var body: some View {
        NavigationStack {
            ZStack {
                // Background
                Color(.systemGroupedBackground)
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 0) {
                        // Category tabs
                        categoryTabs

                        // Main tabs
                        mainTabs

                        if viewModel.isLoading {
                            loadingView
                        } else if viewModel.isSearching && !viewModel.searchResults.isEmpty {
                            searchResultsGrid
                        } else if viewModel.isSearching && viewModel.searchResults.isEmpty {
                            emptySearchView
                        } else {
                            // Trending section
                            if !viewModel.trendingPosts.isEmpty && viewModel.activeTab != .subscriptions {
                                trendingSection
                            }

                            // Main feed
                            feedSection
                        }
                    }
                }
            }
            .navigationTitle("Explore")
            .navigationBarTitleDisplayMode(.large)
            .searchable(text: $viewModel.searchText, prompt: "Search videos...")
            .onSubmit(of: .search) {
                Task { await viewModel.search() }
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showCreatePost = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [brandBlue, .purple],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                    }
                }
            }
            .sheet(item: $viewModel.selectedPost) { post in
                WatchView(post: post, viewModel: viewModel)
            }
            .task {
                await viewModel.loadContent()
            }
            .onChange(of: viewModel.activeTab) { _ in
                Task { await viewModel.loadContent() }
            }
            .onChange(of: viewModel.activeCategory) { _ in
                Task { await viewModel.loadContent() }
            }
            .alert("Error", isPresented: $viewModel.showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.errorMessage ?? "Something went wrong")
            }
        }
    }

    // MARK: - Main Tabs

    private var mainTabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(ExploreTab.allCases, id: \.self) { tab in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            viewModel.activeTab = tab
                        }
                    } label: {
                        Text(tab.rawValue)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(
                                viewModel.activeTab == tab
                                    ? AnyShapeStyle(Color(.label))
                                    : AnyShapeStyle(Color(.systemGray5))
                            )
                            .foregroundColor(
                                viewModel.activeTab == tab
                                    ? Color(.systemBackground)
                                    : Color(.secondaryLabel)
                            )
                            .clipShape(Capsule())
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
    }

    // MARK: - Category Tabs

    private var categoryTabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(exploreCategories, id: \.self) { cat in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            viewModel.activeCategory = cat
                        }
                    } label: {
                        Text(cat)
                            .font(.caption)
                            .fontWeight(.medium)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(
                                viewModel.activeCategory == cat
                                    ? AnyShapeStyle(
                                        LinearGradient(
                                            colors: [brandBlue, brandBlue.opacity(0.8)],
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        )
                                    )
                                    : AnyShapeStyle(Color(.systemGray6))
                            )
                            .foregroundColor(
                                viewModel.activeCategory == cat ? .white : Color(.secondaryLabel)
                            )
                            .clipShape(Capsule())
                    }
                }
            }
            .padding(.horizontal)
        }
    }

    // MARK: - Trending Section

    private var trendingSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "flame.fill")
                    .foregroundColor(.orange)
                Text("Trending Now")
                    .font(.headline)
                    .fontWeight(.bold)
            }
            .padding(.horizontal)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(Array(viewModel.trendingPosts.enumerated()), id: \.element.id) { index, post in
                        TrendingCardView(post: post, rank: index + 1)
                            .onTapGesture {
                                viewModel.selectPost(post)
                            }
                    }
                }
                .padding(.horizontal)
            }
        }
        .padding(.vertical, 12)
    }

    // MARK: - Feed Section

    private var feedSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(viewModel.activeTab.rawValue)
                .font(.headline)
                .fontWeight(.bold)
                .padding(.horizontal)

            if viewModel.feedPosts.isEmpty {
                emptyFeedView
            } else {
                LazyVGrid(columns: columns, spacing: 16) {
                    ForEach(viewModel.feedPosts) { post in
                        VideoCardView(post: post)
                            .onTapGesture {
                                viewModel.selectPost(post)
                            }
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 20)
            }
        }
        .padding(.top, 4)
    }

    // MARK: - Search Results

    private var searchResultsGrid: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Search Results")
                .font(.headline)
                .fontWeight(.bold)
                .padding(.horizontal)

            LazyVGrid(columns: columns, spacing: 16) {
                ForEach(viewModel.searchResults) { post in
                    VideoCardView(post: post)
                        .onTapGesture {
                            viewModel.selectPost(post)
                        }
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 20)
        }
        .padding(.top, 12)
    }

    // MARK: - Empty / Loading States

    private var loadingView: some View {
        VStack(spacing: 12) {
            ProgressView()
                .scaleEffect(1.2)
            Text("Loading explore...")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 80)
    }

    private var emptyFeedView: some View {
        VStack(spacing: 12) {
            Image(systemName: "play.rectangle")
                .font(.system(size: 44))
                .foregroundColor(Color(.systemGray3))
            Text("No videos yet")
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(.secondary)
            Text(viewModel.activeTab == .subscriptions
                 ? "Subscribe to creators to see their videos here"
                 : "Be the first to post a video!")
                .font(.caption)
                .foregroundColor(Color(.tertiaryLabel))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }

    private var emptySearchView: some View {
        VStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 44))
                .foregroundColor(Color(.systemGray3))
            Text("No videos found")
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(.secondary)
            Text("Try a different search term")
                .font(.caption)
                .foregroundColor(Color(.tertiaryLabel))
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }
}

// MARK: - Trending Card

struct TrendingCardView: View {
    let post: Post
    let rank: Int

    private let brandBlue = Color(red: 0.231, green: 0.510, blue: 0.965)

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            // Background
            RoundedRectangle(cornerRadius: 16)
                .fill(
                    LinearGradient(
                        colors: [Color(.systemGray5), Color(.systemGray4)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 280, height: 160)
                .overlay(
                    Image(systemName: "play.fill")
                        .font(.title)
                        .foregroundColor(Color(.systemGray2))
                )

            // Gradient overlay
            LinearGradient(
                colors: [.black.opacity(0.7), .clear],
                startPoint: .bottom,
                endPoint: .center
            )
            .clipShape(RoundedRectangle(cornerRadius: 16))

            // Trending badge
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 8, weight: .bold))
                    Text("#\(rank) TRENDING")
                        .font(.system(size: 9, weight: .heavy))
                }
                .foregroundColor(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    LinearGradient(
                        colors: [.orange, .red],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .clipShape(Capsule())
                .padding(10)

                Spacer()

                VStack(alignment: .leading, spacing: 2) {
                    Text(post.caption)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .lineLimit(1)

                    HStack(spacing: 4) {
                        Text("@\(post.creatorName)")
                            .font(.caption2)
                            .foregroundColor(.white.opacity(0.7))
                        Text("·")
                            .foregroundColor(.white.opacity(0.5))
                        Text("\(post.formattedViews) views")
                            .font(.caption2)
                            .foregroundColor(.white.opacity(0.7))
                    }
                }
                .padding(10)
            }
            .frame(width: 280, height: 160)

            // Duration badge
            Text(post.formattedDuration)
                .font(.system(size: 10, weight: .medium))
                .foregroundColor(.white)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(.black.opacity(0.7))
                .clipShape(RoundedRectangle(cornerRadius: 4))
                .padding(10)
                .frame(width: 280, height: 160, alignment: .bottomTrailing)
        }
        .frame(width: 280, height: 160)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 4)
    }
}

// MARK: - Video Card

struct VideoCardView: View {
    let post: Post

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Thumbnail
            ZStack(alignment: .bottomTrailing) {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(.systemGray5))
                    .aspectRatio(16/9, contentMode: .fill)
                    .overlay(
                        Image(systemName: "play.fill")
                            .foregroundColor(Color(.systemGray3))
                    )

                // Duration
                Text(post.formattedDuration)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(.black.opacity(0.75))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                    .padding(6)
            }
            .clipShape(RoundedRectangle(cornerRadius: 12))

            // Info
            HStack(alignment: .top, spacing: 8) {
                // Avatar
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color(red: 0.231, green: 0.510, blue: 0.965), .purple],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 32, height: 32)
                    .overlay(
                        Text(String(post.creatorName.prefix(1)).uppercased())
                            .font(.caption2)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                    )

                VStack(alignment: .leading, spacing: 2) {
                    Text(post.caption)
                        .font(.caption)
                        .fontWeight(.semibold)
                        .lineLimit(2)
                        .foregroundColor(.primary)

                    Text("@\(post.creatorName)")
                        .font(.caption2)
                        .foregroundColor(.secondary)

                    Text("\(post.formattedViews) views · \(post.relativeTime)")
                        .font(.caption2)
                        .foregroundColor(Color(.tertiaryLabel))
                }
            }
        }
    }
}

#Preview {
    ExploreView()
}
