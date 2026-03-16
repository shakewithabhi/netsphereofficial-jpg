package com.bytebox.feature.share.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.core.common.Result
import com.bytebox.domain.model.ShareLink
import com.bytebox.domain.repository.ShareRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ShareUiState(
    val shares: List<ShareLink> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

@HiltViewModel
class ShareViewModel @Inject constructor(
    private val shareRepository: ShareRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ShareUiState())
    val uiState: StateFlow<ShareUiState> = _uiState.asStateFlow()

    init {
        loadShares()
    }

    fun loadShares() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            when (val result = shareRepository.getMyShares()) {
                is Result.Success -> _uiState.update { it.copy(shares = result.data, isLoading = false) }
                is Result.Error -> _uiState.update { it.copy(isLoading = false, errorMessage = result.exception.message) }
                is Result.Loading -> {}
            }
        }
    }

    fun createShare(fileId: String, password: String? = null, expiresAt: String? = null, maxDownloads: Int? = null) {
        viewModelScope.launch {
            when (val result = shareRepository.createShare(fileId = fileId, password = password, expiresAt = expiresAt, maxDownloads = maxDownloads)) {
                is Result.Success -> loadShares()
                is Result.Error -> _uiState.update { it.copy(errorMessage = result.exception.message) }
                is Result.Loading -> {}
            }
        }
    }

    fun deleteShare(id: String) {
        viewModelScope.launch {
            shareRepository.deleteShare(id)
            loadShares()
        }
    }
}
