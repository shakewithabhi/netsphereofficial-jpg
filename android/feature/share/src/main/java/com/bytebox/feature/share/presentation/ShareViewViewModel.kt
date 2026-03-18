package com.bytebox.feature.share.presentation

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.core.common.Result
import com.bytebox.core.network.api.ShareApi
import com.bytebox.core.network.dto.SaveToStorageRequest
import com.bytebox.core.network.dto.ShareInfoResponse
import com.bytebox.core.network.dto.SharePreviewResponse
import com.bytebox.core.network.safeApiCall
import com.bytebox.domain.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ShareViewUiState(
    val isLoading: Boolean = true,
    val errorMessage: String? = null,
    val shareInfo: ShareInfoResponse? = null,
    val preview: SharePreviewResponse? = null,
    val previewUrl: String? = null,
    val previewDuration: Int = 0,
    val isPreviewEnded: Boolean = false,
    val needsPassword: Boolean = false,
    val passwordError: String? = null,
    val isLoggedIn: Boolean = false,
    val isSaving: Boolean = false,
    val isSaved: Boolean = false,
    val saveError: String? = null,
    val downloadCount: Long = 0,
)

@HiltViewModel
class ShareViewViewModel @Inject constructor(
    private val shareApi: ShareApi,
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ShareViewUiState())
    val uiState: StateFlow<ShareViewUiState> = _uiState.asStateFlow()

    private var currentCode: String = ""
    private var currentPassword: String? = null

    fun loadShareInfo(code: String) {
        currentCode = code
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }

            val loggedIn = try { authRepository.isLoggedIn() } catch (_: Exception) { false }
            _uiState.update { it.copy(isLoggedIn = loggedIn) }

            when (val result = safeApiCall { shareApi.getShareInfo(code) }) {
                is Result.Success -> {
                    val info = result.data
                    val dlCount = try { info.downloadCount ?: 0L } catch (_: Exception) { 0L }
                    if (info.hasPassword) {
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                shareInfo = info,
                                needsPassword = true,
                                downloadCount = dlCount,
                            )
                        }
                    } else {
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                shareInfo = info,
                                needsPassword = false,
                                downloadCount = dlCount,
                            )
                        }
                        loadPreview(code, null)
                    }
                }
                is Result.Error -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = result.exception.message ?: "Failed to load share",
                        )
                    }
                }
                is Result.Loading -> {}
            }
        }
    }

    fun submitPassword(password: String) {
        currentPassword = password
        _uiState.update { it.copy(needsPassword = false, passwordError = null) }
        loadPreview(currentCode, password)
    }

    fun loadPreview(code: String, password: String?) {
        viewModelScope.launch {
            when (val result = safeApiCall { shareApi.getSharePreview(code, password) }) {
                is Result.Success -> {
                    val preview = result.data
                    _uiState.update {
                        it.copy(
                            preview = preview,
                            previewUrl = preview.url,
                            previewDuration = preview.previewDurationSeconds,
                            isPreviewEnded = false,
                        )
                    }
                }
                is Result.Error -> {
                    val msg = result.exception.message ?: "Failed to load preview"
                    if (msg.contains("password", ignoreCase = true) ||
                        msg.contains("unauthorized", ignoreCase = true) ||
                        msg.contains("401", ignoreCase = true)
                    ) {
                        _uiState.update {
                            it.copy(
                                needsPassword = true,
                                passwordError = "Incorrect password. Please try again.",
                            )
                        }
                    }
                    // Preview may not be available for all file types - not a fatal error
                }
                is Result.Loading -> {}
            }
        }
    }

    fun onPreviewEnded() {
        _uiState.update { it.copy(isPreviewEnded = true) }
    }

    fun saveToStorage(code: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, saveError = null) }
            when (val result = safeApiCall {
                shareApi.saveToStorage(code, SaveToStorageRequest(), currentPassword)
            }) {
                is Result.Success -> {
                    _uiState.update { it.copy(isSaving = false, isSaved = true) }
                }
                is Result.Error -> {
                    _uiState.update {
                        it.copy(
                            isSaving = false,
                            saveError = result.exception.message ?: "Save failed",
                        )
                    }
                }
                is Result.Loading -> {}
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null, saveError = null) }
    }
}
