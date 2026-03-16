package com.bytebox.domain.usecase

import com.bytebox.core.common.AppException
import com.bytebox.core.common.Result
import com.bytebox.domain.model.User
import com.bytebox.domain.repository.AuthRepository
import javax.inject.Inject

class RegisterUseCase @Inject constructor(
    private val authRepository: AuthRepository
) {
    suspend operator fun invoke(
        email: String,
        password: String,
        displayName: String
    ): Result<User> {
        if (email.isBlank()) return Result.Error(AppException.ValidationError("Email is required"))
        if (!email.contains("@")) return Result.Error(AppException.ValidationError("Invalid email format"))
        if (password.length < 8) return Result.Error(AppException.ValidationError("Password must be at least 8 characters"))
        if (displayName.isBlank()) return Result.Error(AppException.ValidationError("Display name is required"))
        return authRepository.register(email.trim(), password, displayName.trim())
    }
}
