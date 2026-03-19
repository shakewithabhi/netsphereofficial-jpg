package com.bytebox.feature.explore.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.core.common.Result
import com.bytebox.core.common.onError
import com.bytebox.core.common.onSuccess
import com.bytebox.domain.model.ExploreItem
import com.bytebox.domain.repository.ShareRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
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
        val selectedCategory: String? = null, // null = All, "video", "image"
    )

    private val _uiState = MutableStateFlow(UiState())
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        val category = _uiState.value.selectedCategory
        _uiState.update { it.copy(isLoading = true, errorMessage = null, items = emptyList(), nextCursor = null) }
        viewModelScope.launch {
            shareRepository.getExploreItems(cursor = null, category = category)
                .onSuccess { (items, nextCursor) ->
                    _uiState.update {
                        it.copy(items = items, nextCursor = nextCursor, isLoading = false)
                    }
                }
                .onError { error ->
                    _uiState.update {
                        it.copy(isLoading = false, errorMessage = error.message ?: "Failed to load")
                    }
                }
        }
    }

    // Refresh without clearing existing items (called on screen resume to avoid visible flash)
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
                        it.copy(
                            items = it.items + items,
                            nextCursor = nextCursor,
                            isLoadingMore = false,
                        )
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
