package com.bytebox.feature.auth.presentation.forgotpassword

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.core.common.AppException
import com.bytebox.core.common.Result
import com.bytebox.domain.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ForgotPasswordUiState(
    val email: String = "",
    val token: String = "",
    val newPassword: String = "",
    val confirmPassword: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val forgotSuccess: Boolean = false,
    val resetToken: String? = null,
    val resetSuccess: Boolean = false
)

@HiltViewModel
class ForgotPasswordViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val _uiState = MutableStateFlow(ForgotPasswordUiState())
    val uiState: StateFlow<ForgotPasswordUiState> = _uiState.asStateFlow()

    init {
        val token = savedStateHandle.get<String>("token")
        if (token != null) {
            _uiState.update { it.copy(token = token) }
        }
    }

    fun onEmailChange(email: String) = _uiState.update { it.copy(email = email, errorMessage = null) }
    fun onTokenChange(token: String) = _uiState.update { it.copy(token = token, errorMessage = null) }
    fun onNewPasswordChange(password: String) = _uiState.update { it.copy(newPassword = password, errorMessage = null) }
    fun onConfirmPasswordChange(password: String) = _uiState.update { it.copy(confirmPassword = password, errorMessage = null) }

    fun forgotPassword() {
        val state = _uiState.value
        if (state.email.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Email is required") }
            return
        }
        if (!state.email.contains("@")) {
            _uiState.update { it.copy(errorMessage = "Invalid email format") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }

            when (val result = authRepository.forgotPassword(state.email.trim())) {
                is Result.Success -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            forgotSuccess = true,
                            resetToken = result.data
                        )
                    }
                }
                is Result.Error -> {
                    _uiState.update { it.copy(isLoading = false, errorMessage = result.exception.message) }
                }
                is Result.Loading -> {}
            }
        }
    }

    fun resetPassword() {
        val state = _uiState.value
        if (state.token.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Reset token is required") }
            return
        }
        if (state.newPassword.isBlank()) {
            _uiState.update { it.copy(errorMessage = "New password is required") }
            return
        }
        if (state.newPassword.length < 8) {
            _uiState.update { it.copy(errorMessage = "Password must be at least 8 characters") }
            return
        }
        if (state.newPassword != state.confirmPassword) {
            _uiState.update { it.copy(errorMessage = "Passwords do not match") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }

            when (val result = authRepository.resetPassword(state.token, state.newPassword)) {
                is Result.Success -> {
                    _uiState.update { it.copy(isLoading = false, resetSuccess = true) }
                }
                is Result.Error -> {
                    _uiState.update { it.copy(isLoading = false, errorMessage = result.exception.message) }
                }
                is Result.Loading -> {}
            }
        }
    }

    fun clearError() = _uiState.update { it.copy(errorMessage = null) }
}
