package com.bytebox.domain.usecase

import com.bytebox.core.common.AppException
import com.bytebox.core.common.Result
import com.bytebox.domain.model.User
import com.bytebox.domain.repository.AuthRepository
import javax.inject.Inject

class LoginUseCase @Inject constructor(
    private val authRepository: AuthRepository
) {
    suspend operator fun invoke(email: String, password: String): Result<User> {
        if (email.isBlank()) return Result.Error(AppException.ValidationError("Email is required"))
        if (password.isBlank()) return Result.Error(AppException.ValidationError("Password is required"))
        if (!email.contains("@")) return Result.Error(AppException.ValidationError("Invalid email format"))
        return authRepository.login(email.trim(), password)
    }
}
