package com.bytebox.domain.usecase

import com.bytebox.core.common.AppException
import com.bytebox.core.common.Result
import com.bytebox.domain.model.User
import com.bytebox.domain.repository.AuthRepository
import com.google.common.truth.Truth.assertThat
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Test

class LoginUseCaseTest {

    private lateinit var authRepository: AuthRepository
    private lateinit var loginUseCase: LoginUseCase

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
        authRepository = mockk()
        loginUseCase = LoginUseCase(authRepository)
    }

    @Test
    fun `empty email returns validation error`() = runTest {
        val result = loginUseCase("", "password123")

        assertThat(result).isInstanceOf(Result.Error::class.java)
        val error = result as Result.Error
        assertThat(error.exception).isInstanceOf(AppException.ValidationError::class.java)
        assertThat(error.exception.message).isEqualTo("Email is required")
    }

    @Test
    fun `blank email returns validation error`() = runTest {
        val result = loginUseCase("   ", "password123")

        assertThat(result).isInstanceOf(Result.Error::class.java)
        val error = result as Result.Error
        assertThat(error.exception).isInstanceOf(AppException.ValidationError::class.java)
        assertThat(error.exception.message).isEqualTo("Email is required")
    }

    @Test
    fun `empty password returns validation error`() = runTest {
        val result = loginUseCase("test@example.com", "")

        assertThat(result).isInstanceOf(Result.Error::class.java)
        val error = result as Result.Error
        assertThat(error.exception).isInstanceOf(AppException.ValidationError::class.java)
        assertThat(error.exception.message).isEqualTo("Password is required")
    }

    @Test
    fun `blank password returns validation error`() = runTest {
        val result = loginUseCase("test@example.com", "   ")

        assertThat(result).isInstanceOf(Result.Error::class.java)
        val error = result as Result.Error
        assertThat(error.exception).isInstanceOf(AppException.ValidationError::class.java)
        assertThat(error.exception.message).isEqualTo("Password is required")
    }

    @Test
    fun `invalid email format returns validation error`() = runTest {
        val result = loginUseCase("invalidemail", "password123")

        assertThat(result).isInstanceOf(Result.Error::class.java)
        val error = result as Result.Error
        assertThat(error.exception).isInstanceOf(AppException.ValidationError::class.java)
        assertThat(error.exception.message).isEqualTo("Invalid email format")
    }

    @Test
    fun `valid input calls repository and returns success`() = runTest {
        coEvery { authRepository.login("test@example.com", "password123") } returns Result.Success(testUser)

        val result = loginUseCase("test@example.com", "password123")

        assertThat(result).isInstanceOf(Result.Success::class.java)
        assertThat((result as Result.Success).data).isEqualTo(testUser)
        coVerify(exactly = 1) { authRepository.login("test@example.com", "password123") }
    }

    @Test
    fun `valid input trims email before calling repository`() = runTest {
        coEvery { authRepository.login("test@example.com", "password123") } returns Result.Success(testUser)

        loginUseCase("  test@example.com  ", "password123")

        coVerify { authRepository.login("test@example.com", "password123") }
    }

    @Test
    fun `valid input propagates repository error`() = runTest {
        val networkError = AppException.NetworkError("Connection failed")
        coEvery { authRepository.login(any(), any()) } returns Result.Error(networkError)

        val result = loginUseCase("test@example.com", "password123")

        assertThat(result).isInstanceOf(Result.Error::class.java)
        assertThat((result as Result.Error).exception).isEqualTo(networkError)
    }
}
