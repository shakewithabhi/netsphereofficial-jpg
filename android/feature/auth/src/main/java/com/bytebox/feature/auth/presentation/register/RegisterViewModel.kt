package com.bytebox.feature.auth.presentation.register

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.bytebox.core.common.Result
import com.bytebox.domain.usecase.RegisterUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class RegisterUiState(
    val email: String = "",
    val password: String = "",
    val confirmPassword: String = "",
    val displayName: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val isPasswordVisible: Boolean = false,
    val registerSuccess: Boolean = false
)

@HiltViewModel
class RegisterViewModel @Inject constructor(
    private val registerUseCase: RegisterUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(RegisterUiState())
    val uiState: StateFlow<RegisterUiState> = _uiState.asStateFlow()

    fun onEmailChange(email: String) = _uiState.update { it.copy(email = email, errorMessage = null) }
    fun onPasswordChange(password: String) = _uiState.update { it.copy(password = password, errorMessage = null) }
    fun onConfirmPasswordChange(password: String) = _uiState.update { it.copy(confirmPassword = password, errorMessage = null) }
    fun onDisplayNameChange(name: String) = _uiState.update { it.copy(displayName = name, errorMessage = null) }
    fun togglePasswordVisibility() = _uiState.update { it.copy(isPasswordVisible = !it.isPasswordVisible) }

    fun register() {
        val state = _uiState.value
        if (state.password != state.confirmPassword) {
            _uiState.update { it.copy(errorMessage = "Passwords do not match") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }

            when (val result = registerUseCase(state.email, state.password, state.displayName)) {
                is Result.Success -> {
                    _uiState.update { it.copy(isLoading = false, registerSuccess = true) }
                }
                is Result.Error -> {
                    _uiState.update { it.copy(isLoading = false, errorMessage = result.exception.message) }
                }
                is Result.Loading -> {}
            }
        }
    }
}
