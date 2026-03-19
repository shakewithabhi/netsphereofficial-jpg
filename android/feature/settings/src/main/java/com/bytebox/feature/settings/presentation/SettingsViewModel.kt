package com.bytebox.feature.settings.presentation

import android.content.Context
import android.net.Uri
import android.util.Base64
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.core.common.Result
import com.bytebox.core.datastore.ThemeMode
import com.bytebox.core.datastore.UserPreferences
import com.bytebox.core.worker.AutoUploadWorker
import com.bytebox.domain.model.User
import com.bytebox.domain.repository.AuthRepository
import com.bytebox.feature.files.data.worker.BackupManager
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SettingsUiState(
    val user: User? = null,
    val isLoading: Boolean = false,
    val uploadOnWifiOnly: Boolean = true,
    val themeMode: ThemeMode = ThemeMode.SYSTEM,
    val autoUploadEnabled: Boolean = false,
    val avatarBase64: String? = null,
    val isUploadingAvatar: Boolean = false,
    val avatarMessage: String? = null,
    val isChangingPassword: Boolean = false,
    val changePasswordMessage: String? = null,
    val changePasswordSuccess: Boolean = false,
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val userPreferences: UserPreferences,
    private val backupManager: BackupManager,
    @ApplicationContext private val appContext: Context
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        loadProfile()
        viewModelScope.launch {
            userPreferences.uploadOnWifiOnly.collect { wifiOnly ->
                _uiState.update { it.copy(uploadOnWifiOnly = wifiOnly) }
            }
        }
        viewModelScope.launch {
            userPreferences.themeMode.collect { mode ->
                _uiState.update { it.copy(themeMode = mode) }
            }
        }
        viewModelScope.launch {
            userPreferences.autoUploadEnabled.collect { enabled ->
                _uiState.update { it.copy(autoUploadEnabled = enabled) }
            }
        }
        viewModelScope.launch {
            userPreferences.profileAvatarBase64.collect { base64 ->
                _uiState.update { it.copy(avatarBase64 = base64) }
            }
        }
    }

    fun loadProfile() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            when (val result = authRepository.getProfile()) {
                is Result.Success -> _uiState.update { it.copy(user = result.data, isLoading = false) }
                is Result.Error -> _uiState.update { it.copy(isLoading = false) }
                is Result.Loading -> {}
            }
        }
    }

    fun setUploadOnWifiOnly(wifiOnly: Boolean) {
        viewModelScope.launch { userPreferences.setUploadOnWifiOnly(wifiOnly) }
    }

    fun setThemeMode(mode: ThemeMode) {
        viewModelScope.launch { userPreferences.setThemeMode(mode) }
    }

    fun setAutoUploadEnabled(enabled: Boolean) {
        viewModelScope.launch {
            backupManager.setBackupEnabled(enabled)
            // Also keep the legacy auto-upload worker in sync
            if (enabled) {
                val wifiOnly = userPreferences.uploadOnWifiOnly.first()
                AutoUploadWorker.enqueue(appContext, wifiOnly)
            } else {
                AutoUploadWorker.cancel(appContext)
            }
        }
    }

    fun runBackupNow() {
        backupManager.runBackupNow()
    }

    fun logout(onLoggedOut: () -> Unit) {
        viewModelScope.launch {
            authRepository.logout()
            onLoggedOut()
        }
    }

    fun uploadAvatar(uri: Uri) {
        viewModelScope.launch {
            _uiState.update { it.copy(isUploadingAvatar = true, avatarMessage = null) }

            try {
                val inputStream = appContext.contentResolver.openInputStream(uri)
                val imageBytes = inputStream?.readBytes() ?: run {
                    _uiState.update {
                        it.copy(isUploadingAvatar = false, avatarMessage = "Failed to read image")
                    }
                    return@launch
                }
                inputStream.close()

                val fileName = "avatar_${System.currentTimeMillis()}.jpg"

                when (val result = authRepository.uploadAvatar(imageBytes, fileName)) {
                    is Result.Success -> {
                        _uiState.update {
                            it.copy(
                                user = result.data,
                                isUploadingAvatar = false,
                                avatarMessage = "Profile photo updated",
                            )
                        }
                    }
                    is Result.Error -> {
                        // API endpoint not available, store locally as base64 fallback
                        val base64 = Base64.encodeToString(imageBytes, Base64.NO_WRAP)
                        userPreferences.setProfileAvatarBase64(base64)
                        _uiState.update {
                            it.copy(
                                isUploadingAvatar = false,
                                avatarMessage = "Profile photo saved locally",
                            )
                        }
                    }
                    is Result.Loading -> {}
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isUploadingAvatar = false,
                        avatarMessage = "Failed to upload photo: ${e.message}",
                    )
                }
            }
        }
    }

    fun changePassword(currentPassword: String, newPassword: String) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isChangingPassword = true,
                    changePasswordMessage = null,
                    changePasswordSuccess = false,
                )
            }

            when (val result = authRepository.changePassword(currentPassword, newPassword)) {
                is Result.Success -> {
                    _uiState.update {
                        it.copy(
                            isChangingPassword = false,
                            changePasswordMessage = "Password changed successfully",
                            changePasswordSuccess = true,
                        )
                    }
                }
                is Result.Error -> {
                    val errorMsg = result.exception.message ?: "Failed to change password"
                    _uiState.update {
                        it.copy(
                            isChangingPassword = false,
                            changePasswordMessage = errorMsg,
                            changePasswordSuccess = false,
                        )
                    }
                }
                is Result.Loading -> {}
            }
        }
    }

    fun clearAvatarMessage() {
        _uiState.update { it.copy(avatarMessage = null) }
    }

    fun clearChangePasswordMessage() {
        _uiState.update { it.copy(changePasswordMessage = null, changePasswordSuccess = false) }
    }
}
