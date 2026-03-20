package com.bytebox.domain.repository

import android.net.Uri
import com.bytebox.core.common.Result
import com.bytebox.domain.model.User

interface AuthRepository {
    suspend fun login(email: String, password: String): Result<User>
    suspend fun register(email: String, password: String, displayName: String): Result<User>
    suspend fun googleLogin(idToken: String): Result<User>
    suspend fun logout(): Result<Unit>
    suspend fun refreshToken(): Result<Unit>
    suspend fun isLoggedIn(): Boolean
    suspend fun getProfile(): Result<User>
    suspend fun uploadAvatar(uri: Uri): Result<String>
    suspend fun deleteAvatar(): Result<Unit>
    suspend fun forgotPassword(email: String): Result<String?>
    suspend fun resetPassword(token: String, newPassword: String): Result<Unit>
    suspend fun verify2FALogin(tempToken: String, code: String): Result<User>
    suspend fun changePassword(oldPassword: String, newPassword: String): Result<Unit>
}
