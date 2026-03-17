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

class GoogleLoginUseCaseTest {

    private lateinit var authRepository: AuthRepository
    private lateinit var googleLoginUseCase: GoogleLoginUseCase

    private val testUser = User(
        id = "user-1",
        email = "test@gmail.com",
        displayName = "Test User",
        avatarUrl = "https://example.com/avatar.jpg",
        storageUsed = 0L,
        storageLimit = 1_073_741_824L,
        plan = "free",
        emailVerified = true,
        createdAt = "2026-01-01T00:00:00Z"
    )

    @Before
    fun setUp() {
        authRepository = mockk()
        googleLoginUseCase = GoogleLoginUseCase(authRepository)
    }

    @Test
    fun `blank token returns validation error`() = runTest {
        val result = googleLoginUseCase("")

        assertThat(result).isInstanceOf(Result.Error::class.java)
        val error = result as Result.Error
        assertThat(error.exception).isInstanceOf(AppException.ValidationError::class.java)
        assertThat(error.exception.message).isEqualTo("Google sign-in failed")
    }

    @Test
    fun `whitespace-only token returns validation error`() = runTest {
        val result = googleLoginUseCase("   ")

        assertThat(result).isInstanceOf(Result.Error::class.java)
        val error = result as Result.Error
        assertThat(error.exception).isInstanceOf(AppException.ValidationError::class.java)
        assertThat(error.exception.message).isEqualTo("Google sign-in failed")
    }

    @Test
    fun `valid token calls repository and returns success`() = runTest {
        val idToken = "valid-google-id-token"
        coEvery { authRepository.googleLogin(idToken) } returns Result.Success(testUser)

        val result = googleLoginUseCase(idToken)

        assertThat(result).isInstanceOf(Result.Success::class.java)
        assertThat((result as Result.Success).data).isEqualTo(testUser)
        coVerify(exactly = 1) { authRepository.googleLogin(idToken) }
    }

    @Test
    fun `valid token propagates repository error`() = runTest {
        val idToken = "valid-google-id-token"
        val serverError = AppException.ServerError(401, "Invalid token")
        coEvery { authRepository.googleLogin(idToken) } returns Result.Error(serverError)

        val result = googleLoginUseCase(idToken)

        assertThat(result).isInstanceOf(Result.Error::class.java)
        assertThat((result as Result.Error).exception).isEqualTo(serverError)
    }
}
