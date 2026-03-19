package com.bytebox.feature.explore.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.core.common.onError
import com.bytebox.core.common.onSuccess
import com.bytebox.domain.model.Post
import com.bytebox.domain.model.PostComment
import com.bytebox.domain.repository.ExploreRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

@HiltViewModel
class ExploreViewModel @Inject constructor(
    private val exploreRepository: ExploreRepository,
) : ViewModel() {

    data class UiState(
        // Feed data
        val feed: List<Post> = emptyList(),
        val trending: List<Post> = emptyList(),
        val forYou: List<Post> = emptyList(),
        val subscriptions: List<Post> = emptyList(),

        // Filters
        val currentSort: String = "recent",
        val currentCategory: String? = null,
        val currentTab: FeedTab = FeedTab.FOR_YOU,

        // Selected post (watch page)
        val selectedPost: Post? = null,
        val comments: List<PostComment> = emptyList(),
        val relatedPosts: List<Post> = emptyList(),
        val newCommentText: String = "",

        // Search
        val searchQuery: String = "",
        val searchResults: List<Post> = emptyList(),
        val isSearchActive: Boolean = false,

        // Loading states
        val isLoading: Boolean = false,
        val isLoadingMore: Boolean = false,
        val isLoadingPost: Boolean = false,
        val isLoadingComments: Boolean = false,
        val error: String? = null,

        // Trending tags
        val trendingTags: List<Pair<String, Long>> = emptyList(),

        // Create post
        val isCreatingPost: Boolean = false,
        val createPostSuccess: Boolean = false,
    )

    enum class FeedTab {
        FOR_YOU, TRENDING, SUBSCRIPTIONS
    }

    private val _uiState = MutableStateFlow(UiState())
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    private var searchJob: Job? = null

    init {
        loadInitialData()
    }

    private fun loadInitialData() {
        loadTrending()
        loadForYou()
        loadTrendingTags()
    }

    // ── Feed ────────────────────────────────────────────────────────────────

    fun load() {
        loadInitialData()
    }

    fun loadForYou() {
        _uiState.update { it.copy(isLoading = true, error = null) }
        viewModelScope.launch {
            exploreRepository.getForYouFeed()
                .onSuccess { posts ->
                    _uiState.update { it.copy(forYou = posts, isLoading = false) }
                }
                .onError { e ->
                    _uiState.update { it.copy(isLoading = false, error = e.message) }
                }
        }
    }

    // Refresh without clearing existing items (called on screen resume to avoid visible flash)
    fun refresh() {
        if (_uiState.value.isLoading) return
        loadInitialData()
    }

    fun loadTrending() {
        viewModelScope.launch {
            exploreRepository.getTrendingFeed()
                .onSuccess { posts ->
                    _uiState.update { it.copy(trending = posts) }
                }
        }
    }

    fun loadSubscriptions() {
        _uiState.update { it.copy(isLoading = true, error = null) }
        viewModelScope.launch {
            exploreRepository.getSubscriptionFeed()
                .onSuccess { posts ->
                    _uiState.update { it.copy(subscriptions = posts, isLoading = false) }
                }
                .onError { e ->
                    _uiState.update { it.copy(isLoading = false, error = e.message) }
                }
        }
    }

    fun loadFeed() {
        val state = _uiState.value
        _uiState.update { it.copy(isLoading = true, error = null) }
        viewModelScope.launch {
            exploreRepository.getFeed(
                sort = state.currentSort,
                category = state.currentCategory,
            )
                .onSuccess { posts ->
                    _uiState.update { it.copy(feed = posts, isLoading = false) }
                }
                .onError { e ->
                    _uiState.update { it.copy(isLoading = false, error = e.message) }
                }
        }
    }

    fun loadTrendingTags() {
        viewModelScope.launch {
            exploreRepository.getTrendingTags()
                .onSuccess { tags ->
                    _uiState.update { it.copy(trendingTags = tags) }
                }
        }
    }

    fun setTab(tab: FeedTab) {
        _uiState.update { it.copy(currentTab = tab) }
        when (tab) {
            FeedTab.FOR_YOU -> if (_uiState.value.forYou.isEmpty()) loadForYou()
            FeedTab.TRENDING -> if (_uiState.value.trending.isEmpty()) loadTrending()
            FeedTab.SUBSCRIPTIONS -> loadSubscriptions()
        }
    }

    fun setCategory(category: String?) {
        _uiState.update { it.copy(currentCategory = category) }
        loadFeed()
    }

    fun setSort(sort: String) {
        _uiState.update { it.copy(currentSort = sort) }
        loadFeed()
    }

    // ── Search ──────────────────────────────────────────────────────────────

    fun setSearchQuery(query: String) {
        _uiState.update { it.copy(searchQuery = query) }
        searchJob?.cancel()
        if (query.isBlank()) {
            _uiState.update { it.copy(searchResults = emptyList(), isSearchActive = false) }
            return
        }
        _uiState.update { it.copy(isSearchActive = true) }
        searchJob = viewModelScope.launch {
            delay(400) // debounce
            exploreRepository.searchPosts(query)
                .onSuccess { posts ->
                    _uiState.update { it.copy(searchResults = posts) }
                }
        }
    }

    fun clearSearch() {
        _uiState.update { it.copy(searchQuery = "", searchResults = emptyList(), isSearchActive = false) }
    }

    // ── Post selection (watch page) ──────────────────────────────────────────

    fun selectPost(postId: String) {
        _uiState.update { it.copy(isLoadingPost = true) }
        viewModelScope.launch {
            exploreRepository.getPost(postId)
                .onSuccess { post ->
                    _uiState.update {
                        it.copy(selectedPost = post, isLoadingPost = false)
                    }
                    loadComments(postId)
                    loadRelatedPosts(postId)
                    // Record view after 3 seconds
                    launch {
                        delay(3000)
                        exploreRepository.recordView(postId, 3)
                    }
                }
                .onError { e ->
                    _uiState.update { it.copy(isLoadingPost = false, error = e.message) }
                }
        }
    }

    fun clearSelectedPost() {
        _uiState.update {
            it.copy(
                selectedPost = null,
                comments = emptyList(),
                relatedPosts = emptyList(),
                newCommentText = "",
            )
        }
    }

    private fun loadComments(postId: String) {
        _uiState.update { it.copy(isLoadingComments = true) }
        viewModelScope.launch {
            exploreRepository.getPostComments(postId)
                .onSuccess { comments ->
                    _uiState.update { it.copy(comments = comments, isLoadingComments = false) }
                }
                .onError {
                    _uiState.update { it.copy(isLoadingComments = false) }
                }
        }
    }

    private fun loadRelatedPosts(postId: String) {
        viewModelScope.launch {
            exploreRepository.getRelatedPosts(postId)
                .onSuccess { posts ->
                    _uiState.update { it.copy(relatedPosts = posts) }
                }
        }
    }

    // ── Interactions ────────────────────────────────────────────────────────

    fun toggleLike(postId: String) {
        val state = _uiState.value
        // Optimistic update
        val updatePost: (Post) -> Post = { post ->
            if (post.id == postId) {
                post.copy(
                    isLiked = !post.isLiked,
                    likeCount = if (post.isLiked) post.likeCount - 1 else post.likeCount + 1,
                )
            } else post
        }
        _uiState.update {
            it.copy(
                forYou = it.forYou.map(updatePost),
                trending = it.trending.map(updatePost),
                subscriptions = it.subscriptions.map(updatePost),
                feed = it.feed.map(updatePost),
                searchResults = it.searchResults.map(updatePost),
                selectedPost = it.selectedPost?.let(updatePost),
            )
        }

        val wasLiked = state.forYou.find { it.id == postId }?.isLiked
            ?: state.trending.find { it.id == postId }?.isLiked
            ?: state.selectedPost?.takeIf { it.id == postId }?.isLiked
            ?: false

        viewModelScope.launch {
            if (wasLiked) {
                exploreRepository.unlikePost(postId)
            } else {
                exploreRepository.likePost(postId)
            }
        }
    }

    fun toggleSubscribe(userId: String) {
        val state = _uiState.value
        val updatePost: (Post) -> Post = { post ->
            if (post.userId == userId) {
                post.copy(
                    isSubscribed = !post.isSubscribed,
                    subscriberCount = if (post.isSubscribed) post.subscriberCount - 1 else post.subscriberCount + 1,
                )
            } else post
        }
        _uiState.update {
            it.copy(
                forYou = it.forYou.map(updatePost),
                trending = it.trending.map(updatePost),
                subscriptions = it.subscriptions.map(updatePost),
                feed = it.feed.map(updatePost),
                selectedPost = it.selectedPost?.let(updatePost),
            )
        }

        val wasSubscribed = state.selectedPost?.takeIf { it.userId == userId }?.isSubscribed ?: false
        viewModelScope.launch {
            if (wasSubscribed) {
                exploreRepository.unsubscribe(userId)
            } else {
                exploreRepository.subscribe(userId)
            }
        }
    }

    fun setNewCommentText(text: String) {
        _uiState.update { it.copy(newCommentText = text) }
    }

    fun addComment() {
        val state = _uiState.value
        val postId = state.selectedPost?.id ?: return
        val content = state.newCommentText.trim()
        if (content.isBlank()) return

        _uiState.update { it.copy(newCommentText = "") }
        viewModelScope.launch {
            exploreRepository.addComment(postId, content)
                .onSuccess { comment ->
                    _uiState.update {
                        it.copy(
                            comments = listOf(comment) + it.comments,
                            selectedPost = it.selectedPost?.copy(
                                commentCount = it.selectedPost.commentCount + 1,
                            ),
                        )
                    }
                }
        }
    }

    fun deleteComment(commentId: String) {
        val postId = _uiState.value.selectedPost?.id ?: return
        viewModelScope.launch {
            exploreRepository.deleteComment(postId, commentId)
                .onSuccess {
                    _uiState.update {
                        it.copy(
                            comments = it.comments.filter { c -> c.id != commentId },
                            selectedPost = it.selectedPost?.copy(
                                commentCount = (it.selectedPost.commentCount - 1).coerceAtLeast(0),
                            ),
                        )
                    }
                }
        }
    }

    fun recordView(postId: String, durationSeconds: Int) {
        viewModelScope.launch {
            exploreRepository.recordView(postId, durationSeconds)
        }
    }

    fun createPost(fileId: String, caption: String, category: String, tags: List<String>) {
        _uiState.update { it.copy(isCreatingPost = true) }
        viewModelScope.launch {
            exploreRepository.createPost(fileId, caption, category, tags)
                .onSuccess {
                    _uiState.update { it.copy(isCreatingPost = false, createPostSuccess = true) }
                    loadForYou()
                }
                .onError { e ->
                    _uiState.update { it.copy(isCreatingPost = false, error = e.message) }
                }
        }
    }

    fun clearCreatePostSuccess() {
        _uiState.update { it.copy(createPostSuccess = false) }
    }

    fun reportPost(id: String, reason: String) {
        viewModelScope.launch {
            exploreRepository.reportPost(id, reason)
        }
    }

    fun loadMore() {
        // No-op for now (pagination can be added later)
    }
}
