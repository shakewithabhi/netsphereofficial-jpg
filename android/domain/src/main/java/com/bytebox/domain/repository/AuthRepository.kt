package com.bytebox.domain.repository

import com.bytebox.core.common.Result
import com.bytebox.domain.model.User

interface AuthRepository {
    suspend fun login(email: String, password: String): Result<User>
    suspend fun register(email: String, password: String, displayName: String): Result<User>
    suspend fun logout(): Result<Unit>
    suspend fun refreshToken(): Result<Unit>
    suspend fun isLoggedIn(): Boolean
    suspend fun getProfile(): Result<User>
}
