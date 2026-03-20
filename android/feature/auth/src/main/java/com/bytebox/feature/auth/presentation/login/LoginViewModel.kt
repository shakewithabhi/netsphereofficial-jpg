package com.bytebox.feature.auth.presentation.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.core.common.AppException
import com.bytebox.core.common.Result
import com.bytebox.domain.repository.AuthRepository
import com.bytebox.domain.usecase.GoogleLoginUseCase
import com.bytebox.domain.usecase.LoginUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val isPasswordVisible: Boolean = false,
    val loginSuccess: Boolean = false,
    val show2FA: Boolean = false,
    val tempToken: String? = null,
    val twoFactorError: String? = null,
    val is2FALoading: Boolean = false
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val loginUseCase: LoginUseCase,
    private val googleLoginUseCase: GoogleLoginUseCase,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun onEmailChange(email: String) {
        _uiState.update { it.copy(email = email, errorMessage = null) }
    }

    fun onPasswordChange(password: String) {
        _uiState.update { it.copy(password = password, errorMessage = null) }
    }

    fun togglePasswordVisibility() {
        _uiState.update { it.copy(isPasswordVisible = !it.isPasswordVisible) }
    }

    fun login() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }

            when (val result = loginUseCase(_uiState.value.email, _uiState.value.password)) {
                is Result.Success -> {
                    _uiState.update { it.copy(isLoading = false, loginSuccess = true) }
                }
                is Result.Error -> {
                    val exception = result.exception
                    if (exception is AppException.TwoFactorRequired) {
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                show2FA = true,
                                tempToken = exception.tempToken
                            )
                        }
                    } else {
                        _uiState.update { it.copy(isLoading = false, errorMessage = exception.message) }
                    }
                }
                is Result.Loading -> {}
            }
        }
    }

    fun verify2FA(code: String) {
        val tempToken = _uiState.value.tempToken ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(is2FALoading = true, twoFactorError = null) }

            when (val result = authRepository.verify2FALogin(tempToken, code)) {
                is Result.Success -> {
                    _uiState.update { it.copy(is2FALoading = false, show2FA = false, loginSuccess = true) }
                }
                is Result.Error -> {
                    _uiState.update { it.copy(is2FALoading = false, twoFactorError = result.exception.message) }
                }
                is Result.Loading -> {}
            }
        }
    }

    fun dismiss2FA() {
        _uiState.update { it.copy(show2FA = false, tempToken = null, twoFactorError = null) }
    }

    fun googleLogin(idToken: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }

            when (val result = googleLoginUseCase(idToken)) {
                is Result.Success -> {
                    _uiState.update { it.copy(isLoading = false, loginSuccess = true) }
                }
                is Result.Error -> {
                    _uiState.update { it.copy(isLoading = false, errorMessage = result.exception.message) }
                }
                is Result.Loading -> {}
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(errorMessage = null) }
    }

    fun fillTestCredentials(email: String, password: String) {
        _uiState.update { it.copy(email = email, password = password, errorMessage = null) }
    }
}
