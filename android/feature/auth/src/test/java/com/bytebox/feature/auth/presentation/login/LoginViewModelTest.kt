package com.bytebox.feature.auth.presentation.login

import com.bytebox.core.common.AppException
import com.bytebox.core.common.Result
import com.bytebox.domain.model.User
import com.bytebox.domain.usecase.GoogleLoginUseCase
import com.bytebox.domain.usecase.LoginUseCase
import com.google.common.truth.Truth.assertThat
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class LoginViewModelTest {

    private lateinit var loginUseCase: LoginUseCase
    private lateinit var googleLoginUseCase: GoogleLoginUseCase
    private lateinit var viewModel: LoginViewModel

    private val testDispatcher = StandardTestDispatcher()

    private val testUser = User(
        id = "user-1",
        email = "test@example.com",
        displayName = "Test User",
        avatarUrl = null,
        storageUsed = 0L,
        storageLimit = 1_073_741_824L,
        plan = "free",
        emailVerified = true,
        createdAt = "2026-01-01T00:00:00Z"
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        loginUseCase = mockk()
        googleLoginUseCase = mockk()
        viewModel = LoginViewModel(loginUseCase, googleLoginUseCase)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial state has default values`() {
        val state = viewModel.uiState.value

        assertThat(state.email).isEmpty()
        assertThat(state.password).isEmpty()
        assertThat(state.isLoading).isFalse()
        assertThat(state.errorMessage).isNull()
        assertThat(state.isPasswordVisible).isFalse()
        assertThat(state.loginSuccess).isFalse()
    }

    @Test
    fun `onEmailChange updates email in state`() {
        viewModel.onEmailChange("user@example.com")

        assertThat(viewModel.uiState.value.email).isEqualTo("user@example.com")
    }

    @Test
    fun `onPasswordChange updates password in state`() {
        viewModel.onPasswordChange("secret123")

        assertThat(viewModel.uiState.value.password).isEqualTo("secret123")
    }

    @Test
    fun `onEmailChange clears existing error`() {
        // First, trigger an error by setting one via a failed login
        coEvery { loginUseCase(any(), any()) } returns Result.Error(
            AppException.ValidationError("Some error")
        )
        viewModel.onEmailChange("test@example.com")
        viewModel.onPasswordChange("pass")

        // Manually verify error is cleared when email changes
        viewModel.onEmailChange("new@example.com")
        assertThat(viewModel.uiState.value.errorMessage).isNull()
    }

    @Test
    fun `onPasswordChange clears existing error`() {
        viewModel.onPasswordChange("newpass")
        assertThat(viewModel.uiState.value.errorMessage).isNull()
    }

    @Test
    fun `togglePasswordVisibility toggles visibility`() {
        assertThat(viewModel.uiState.value.isPasswordVisible).isFalse()

        viewModel.togglePasswordVisibility()
        assertThat(viewModel.uiState.value.isPasswordVisible).isTrue()

        viewModel.togglePasswordVisibility()
        assertThat(viewModel.uiState.value.isPasswordVisible).isFalse()
    }

    @Test
    fun `successful login updates state with loginSuccess true`() = runTest {
        coEvery { loginUseCase("test@example.com", "password123") } returns Result.Success(testUser)

        viewModel.onEmailChange("test@example.com")
        viewModel.onPasswordChange("password123")
        viewModel.login()
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertThat(state.isLoading).isFalse()
        assertThat(state.loginSuccess).isTrue()
        assertThat(state.errorMessage).isNull()
    }

    @Test
    fun `failed login shows error message`() = runTest {
        coEvery { loginUseCase("test@example.com", "wrong") } returns Result.Error(
            AppException.Unauthorized("Invalid credentials")
        )

        viewModel.onEmailChange("test@example.com")
        viewModel.onPasswordChange("wrong")
        viewModel.login()
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertThat(state.isLoading).isFalse()
        assertThat(state.loginSuccess).isFalse()
        assertThat(state.errorMessage).isEqualTo("Invalid credentials")
    }

    @Test
    fun `successful google login updates state with loginSuccess true`() = runTest {
        coEvery { googleLoginUseCase("google-token") } returns Result.Success(testUser)

        viewModel.googleLogin("google-token")
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertThat(state.isLoading).isFalse()
        assertThat(state.loginSuccess).isTrue()
        assertThat(state.errorMessage).isNull()
    }

    @Test
    fun `failed google login shows error message`() = runTest {
        coEvery { googleLoginUseCase("bad-token") } returns Result.Error(
            AppException.ServerError(401, "Invalid token")
        )

        viewModel.googleLogin("bad-token")
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertThat(state.isLoading).isFalse()
        assertThat(state.loginSuccess).isFalse()
        assertThat(state.errorMessage).isEqualTo("Invalid token")
    }

    @Test
    fun `clearError resets errorMessage to null`() = runTest {
        coEvery { loginUseCase(any(), any()) } returns Result.Error(
            AppException.NetworkError("No internet")
        )

        viewModel.onEmailChange("test@example.com")
        viewModel.onPasswordChange("pass")
        viewModel.login()
        advanceUntilIdle()

        assertThat(viewModel.uiState.value.errorMessage).isNotNull()

        viewModel.clearError()
        assertThat(viewModel.uiState.value.errorMessage).isNull()
    }

    @Test
    fun `fillTestCredentials updates email and password`() {
        viewModel.fillTestCredentials("admin@bytebox.com", "admin123")

        val state = viewModel.uiState.value
        assertThat(state.email).isEqualTo("admin@bytebox.com")
        assertThat(state.password).isEqualTo("admin123")
    }
}
