package com.bytebox.feature.explore.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.core.common.onError
import com.bytebox.core.common.onSuccess
import com.bytebox.domain.model.ShareComment
import com.bytebox.domain.model.ShareInfo
import com.bytebox.domain.repository.ShareRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ExploreVideoViewModel @Inject constructor(
    private val shareRepository: ShareRepository,
) : ViewModel() {

    data class UiState(
        val isLoading: Boolean = true,
        val error: String? = null,
        val shareInfo: ShareInfo? = null,
        val downloadUrl: String? = null,
        val isDownloading: Boolean = false,
        val isLikeLoading: Boolean = false,
        val comments: List<ShareComment> = emptyList(),
        val isCommentsLoading: Boolean = false,
        val commentText: String = "",
        val isSubmittingComment: Boolean = false,
        val commentError: String? = null,
    )

    private val _uiState = MutableStateFlow(UiState())
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    fun load(code: String) {
        _uiState.update { it.copy(isLoading = true, error = null) }
        viewModelScope.launch {
            shareRepository.getPublicShareInfo(code)
                .onSuccess { info ->
                    _uiState.update { it.copy(isLoading = false, shareInfo = info) }
                }
                .onError { err ->
                    _uiState.update { it.copy(isLoading = false, error = err.message ?: "Failed to load") }
                }
        }
        loadComments(code)
    }

    fun loadComments(code: String) {
        _uiState.update { it.copy(isCommentsLoading = true) }
        viewModelScope.launch {
            shareRepository.getComments(code)
                .onSuccess { comments ->
                    _uiState.update { it.copy(comments = comments, isCommentsLoading = false) }
                }
                .onError {
                    _uiState.update { it.copy(isCommentsLoading = false) }
                }
        }
    }

    fun fetchDownloadUrl(code: String, onReady: (String) -> Unit) {
        if (_uiState.value.isDownloading) return
        _uiState.update { it.copy(isDownloading = true) }
        viewModelScope.launch {
            shareRepository.getPublicDownloadUrl(code)
                .onSuccess { url ->
                    _uiState.update { it.copy(isDownloading = false, downloadUrl = url) }
                    onReady(url)
                }
                .onError {
                    _uiState.update { it.copy(isDownloading = false) }
                }
        }
    }

    fun toggleLike(code: String) {
        if (_uiState.value.isLikeLoading) return
        _uiState.update { it.copy(isLikeLoading = true) }
        viewModelScope.launch {
            shareRepository.toggleLike(code)
                .onSuccess { (liked, count) ->
                    _uiState.update { state ->
                        state.copy(
                            isLikeLoading = false,
                            shareInfo = state.shareInfo?.copy(isLiked = liked, likeCount = count),
                        )
                    }
                }
                .onError {
                    _uiState.update { it.copy(isLikeLoading = false) }
                }
        }
    }

    fun updateCommentText(text: String) {
        _uiState.update { it.copy(commentText = text, commentError = null) }
    }

    fun submitComment(code: String) {
        val content = _uiState.value.commentText.trim()
        if (content.isBlank()) {
            _uiState.update { it.copy(commentError = "Comment cannot be empty") }
            return
        }
        _uiState.update { it.copy(isSubmittingComment = true, commentError = null) }
        viewModelScope.launch {
            shareRepository.addComment(code, content)
                .onSuccess { comment ->
                    _uiState.update { state ->
                        state.copy(
                            isSubmittingComment = false,
                            commentText = "",
                            comments = state.comments + comment,
                            shareInfo = state.shareInfo?.copy(
                                commentCount = state.shareInfo.commentCount + 1
                            ),
                        )
                    }
                }
                .onError { err ->
                    _uiState.update {
                        it.copy(
                            isSubmittingComment = false,
                            commentError = err.message ?: "Failed to post comment",
                        )
                    }
                }
        }
    }
}
