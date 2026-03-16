package com.bytebox.feature.settings.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.core.common.Result
import com.bytebox.core.datastore.UserPreferences
import com.bytebox.domain.model.User
import com.bytebox.domain.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SettingsUiState(
    val user: User? = null,
    val isLoading: Boolean = false,
    val uploadOnWifiOnly: Boolean = true
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val userPreferences: UserPreferences
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

    fun logout(onLoggedOut: () -> Unit) {
        viewModelScope.launch {
            authRepository.logout()
            onLoggedOut()
        }
    }
}
