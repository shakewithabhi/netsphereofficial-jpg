package com.bytebox.feature.explore.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.core.common.Result
import com.bytebox.core.common.onError
import com.bytebox.core.common.onSuccess
import com.bytebox.domain.model.ExploreItem
import com.bytebox.domain.repository.ShareRepository
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
    private val shareRepository: ShareRepository,
) : ViewModel() {

    data class UiState(
        val items: List<ExploreItem> = emptyList(),
        val isLoading: Boolean = false,
        val isLoadingMore: Boolean = false,
        val errorMessage: String? = null,
        val nextCursor: String? = null,
        val selectedCategory: String? = null,
        // Search
        val searchQuery: String = "",
        val isSearchActive: Boolean = false,
        val searchResults: List<ExploreItem> = emptyList(),
        val isSearching: Boolean = false,
        val suggestions: List<ExploreItem> = emptyList(),
        val showSuggestions: Boolean = false,
    )

    private val _uiState = MutableStateFlow(UiState())
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    // In-memory cache: query -> results (avoids re-fetching same query)
    private val searchCache = LinkedHashMap<String, List<ExploreItem>>(16, 0.75f, true)
    private var searchJob: Job? = null

    init {
        load()
    }

    // ── Search ──────────────────────────────────────────────────────────────

    fun onSearchQueryChanged(query: String) {
        _uiState.update { it.copy(searchQuery = query) }

        searchJob?.cancel()
        if (query.isBlank()) {
            _uiState.update { it.copy(suggestions = emptyList(), showSuggestions = false, searchResults = emptyList()) }
            return
        }

        // Check cache first for instant suggestions
        val cached = searchCache[query.lowercase()]
        if (cached != null) {
            _uiState.update { it.copy(suggestions = cached.take(5), showSuggestions = true) }
        }

        // Debounce: 300ms before hitting API
        searchJob = viewModelScope.launch {
            delay(300)
            fetchSearchResults(query, isSuggestion = true)
        }
    }

    fun submitSearch() {
        val query = _uiState.value.searchQuery
        if (query.isBlank()) return
        _uiState.update { it.copy(showSuggestions = false, isSearching = true) }
        viewModelScope.launch {
            fetchSearchResults(query, isSuggestion = false)
        }
    }

    fun clearSearch() {
        searchJob?.cancel()
        _uiState.update {
            it.copy(
                searchQuery = "",
                isSearchActive = false,
                searchResults = emptyList(),
                suggestions = emptyList(),
                showSuggestions = false,
            )
        }
    }

    fun activateSearch() {
        _uiState.update { it.copy(isSearchActive = true) }
    }

    fun dismissSuggestions() {
        _uiState.update { it.copy(showSuggestions = false) }
    }

    private suspend fun fetchSearchResults(query: String, isSuggestion: Boolean) {
        val cacheKey = query.lowercase()
        shareRepository.searchExploreItems(query = query, limit = if (isSuggestion) 10 else 30)
            .onSuccess { items ->
                // Cache result
                searchCache[cacheKey] = items
                // Evict old entries (keep max 30)
                while (searchCache.size > 30) {
                    searchCache.remove(searchCache.keys.first())
                }

                if (isSuggestion) {
                    _uiState.update {
                        it.copy(suggestions = items.take(5), showSuggestions = items.isNotEmpty())
                    }
                } else {
                    _uiState.update {
                        it.copy(searchResults = items, isSearching = false, showSuggestions = false)
                    }
                }
            }
            .onError {
                if (!isSuggestion) {
                    _uiState.update { it.copy(isSearching = false, errorMessage = it.errorMessage) }
                }
            }
    }

    // ── Feed ────────────────────────────────────────────────────────────────

    fun load() {
        val category = _uiState.value.selectedCategory
        _uiState.update { it.copy(isLoading = true, errorMessage = null, items = emptyList(), nextCursor = null) }
        viewModelScope.launch {
            shareRepository.getExploreItems(cursor = null, category = category)
                .onSuccess { (items, nextCursor) ->
                    _uiState.update { it.copy(items = items, nextCursor = nextCursor, isLoading = false) }
                }
                .onError { error ->
                    _uiState.update { it.copy(isLoading = false, errorMessage = error.message ?: "Failed to load") }
                }
        }
    }

    fun refresh() {
        if (_uiState.value.isLoading) return
        val category = _uiState.value.selectedCategory
        _uiState.update { it.copy(isLoading = true, errorMessage = null, nextCursor = null) }
        viewModelScope.launch {
            shareRepository.getExploreItems(cursor = null, category = category)
                .onSuccess { (items, nextCursor) ->
                    _uiState.update { it.copy(items = items, nextCursor = nextCursor, isLoading = false) }
                }
                .onError { error ->
                    _uiState.update { it.copy(isLoading = false, errorMessage = error.message ?: "Failed to load") }
                }
        }
    }

    fun loadMore() {
        val state = _uiState.value
        if (state.isLoadingMore || state.nextCursor == null) return
        _uiState.update { it.copy(isLoadingMore = true) }
        viewModelScope.launch {
            shareRepository.getExploreItems(cursor = state.nextCursor, category = state.selectedCategory)
                .onSuccess { (items, nextCursor) ->
                    _uiState.update {
                        it.copy(items = it.items + items, nextCursor = nextCursor, isLoadingMore = false)
                    }
                }
                .onError { _uiState.update { it.copy(isLoadingMore = false) } }
        }
    }

    fun setCategory(category: String?) {
        if (_uiState.value.selectedCategory == category) return
        _uiState.update { it.copy(selectedCategory = category) }
        load()
    }
}
