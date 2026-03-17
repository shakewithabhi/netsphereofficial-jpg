package com.bytebox.domain.usecase

import com.bytebox.core.common.AppException
import com.bytebox.core.common.Result
import com.bytebox.domain.model.User
import com.bytebox.domain.repository.AuthRepository
import javax.inject.Inject

class GoogleLoginUseCase @Inject constructor(
    private val authRepository: AuthRepository
) {
    suspend operator fun invoke(idToken: String): Result<User> {
        if (idToken.isBlank()) return Result.Error(AppException.ValidationError("Google sign-in failed"))
        return authRepository.googleLogin(idToken)
    }
}
