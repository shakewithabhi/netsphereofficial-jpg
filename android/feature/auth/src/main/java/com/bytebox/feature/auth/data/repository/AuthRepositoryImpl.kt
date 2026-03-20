package com.bytebox.feature.auth.data.repository

import android.content.Context
import android.net.Uri
import com.bytebox.core.common.Result
import com.bytebox.core.database.dao.FileDao
import com.bytebox.core.database.dao.FolderDao
import com.bytebox.core.database.dao.UploadTaskDao
import com.bytebox.core.datastore.TokenManager
import com.bytebox.core.network.api.AuthApi
import com.bytebox.core.network.api.UserApi
import com.bytebox.core.network.dto.ChangePasswordRequest
import com.bytebox.core.network.dto.ForgotPasswordRequest
import com.bytebox.core.network.dto.GoogleLoginRequest
import com.bytebox.core.network.dto.LoginRequest
import com.bytebox.core.network.dto.RegisterRequest
import com.bytebox.core.network.dto.ResetPasswordRequest
import com.bytebox.core.network.dto.TwoFactorLoginRequest
import com.bytebox.core.network.safeApiCall
import com.bytebox.core.common.AppException
import com.bytebox.domain.model.User
import com.bytebox.domain.repository.AuthRepository
import com.bytebox.core.common.map
import dagger.hilt.android.qualifiers.ApplicationContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject

class AuthRepositoryImpl @Inject constructor(
    private val authApi: AuthApi,
    private val userApi: UserApi,
    private val tokenManager: TokenManager,
    private val fileDao: FileDao,
    private val folderDao: FolderDao,
    private val uploadTaskDao: UploadTaskDao,
    @ApplicationContext private val context: Context
) : AuthRepository {

    override suspend fun login(email: String, password: String): Result<User> {
        // Clear any cached data from previous user before login
        fileDao.deleteAll()
        folderDao.deleteAll()
        uploadTaskDao.deleteAll()

        val result = safeApiCall {
            authApi.login(LoginRequest(email, password, android.os.Build.MODEL))
        }
        return when (result) {
            is Result.Success -> {
                val data = result.data
                if (data.requiresTwoFactor == true && data.tempToken != null) {
                    Result.Error(AppException.TwoFactorRequired(data.tempToken!!))
                } else {
                    tokenManager.saveTokens(data.accessToken!!, data.refreshToken!!)
                    Result.Success(data.user!!.toDomain())
                }
            }
            is Result.Error -> result
            is Result.Loading -> result
        }
    }

    override suspend fun googleLogin(idToken: String): Result<User> {
        fileDao.deleteAll()
        folderDao.deleteAll()
        uploadTaskDao.deleteAll()

        val result = safeApiCall {
            authApi.googleLogin(GoogleLoginRequest(idToken))
        }
        return when (result) {
            is Result.Success -> {
                tokenManager.saveTokens(result.data.accessToken!!, result.data.refreshToken!!)
                Result.Success(result.data.user!!.toDomain())
            }
            is Result.Error -> result
            is Result.Loading -> result
        }
    }

    override suspend fun register(email: String, password: String, displayName: String): Result<User> {
        // Clear any cached data from previous user before register
        fileDao.deleteAll()
        folderDao.deleteAll()
        uploadTaskDao.deleteAll()

        val result = safeApiCall {
            authApi.register(RegisterRequest(email, password, displayName))
        }
        return when (result) {
            is Result.Success -> {
                tokenManager.saveTokens(result.data.accessToken!!, result.data.refreshToken!!)
                Result.Success(result.data.user!!.toDomain())
            }
            is Result.Error -> result
            is Result.Loading -> result
        }
    }

    override suspend fun logout(): Result<Unit> {
        safeApiCall { authApi.logout() }
        tokenManager.clearTokens()
        fileDao.deleteAll()
        folderDao.deleteAll()
        uploadTaskDao.deleteAll()
        return Result.Success(Unit)
    }

    override suspend fun refreshToken(): Result<Unit> {
        // Handled by TokenRefreshInterceptor
        return Result.Success(Unit)
    }

    override suspend fun isLoggedIn(): Boolean = tokenManager.isLoggedIn()

    override suspend fun getProfile(): Result<User> {
        return safeApiCall { userApi.getProfile() }.map { it.toDomain() }
    }

    override suspend fun forgotPassword(email: String): Result<String?> {
        val result = safeApiCall {
            authApi.forgotPassword(ForgotPasswordRequest(email))
        }
        return when (result) {
            is Result.Success -> Result.Success(result.data.token)
            is Result.Error -> result
            is Result.Loading -> result
        }
    }

    override suspend fun resetPassword(token: String, newPassword: String): Result<Unit> {
        val result = safeApiCall {
            authApi.resetPassword(ResetPasswordRequest(token, newPassword))
        }
        return when (result) {
            is Result.Success -> Result.Success(Unit)
            is Result.Error -> result
            is Result.Loading -> result
        }
    }

    override suspend fun uploadAvatar(uri: Uri): Result<String> {
        val contentResolver = context.contentResolver
        val mimeType = contentResolver.getType(uri) ?: "image/jpeg"
        val bytes = contentResolver.openInputStream(uri)?.use { it.readBytes() }
            ?: return Result.Error(AppException.Unknown("Failed to read image"))

        val requestBody = bytes.toRequestBody(mimeType.toMediaTypeOrNull())
        val part = MultipartBody.Part.createFormData("avatar", "avatar.jpg", requestBody)

        return safeApiCall { userApi.uploadAvatar(part) }.map { it.avatarUrl }
    }

    override suspend fun deleteAvatar(): Result<Unit> {
        return safeApiCall { userApi.deleteAvatar() }
    }

    override suspend fun verify2FALogin(tempToken: String, code: String): Result<User> {
        val result = safeApiCall {
            authApi.verify2FALogin(TwoFactorLoginRequest(tempToken, code))
        }
        return when (result) {
            is Result.Success -> {
                val data = result.data
                tokenManager.saveTokens(data.accessToken!!, data.refreshToken!!)
                Result.Success(data.user!!.toDomain())
            }
            is Result.Error -> result
            is Result.Loading -> result
        }
    }

    override suspend fun changePassword(oldPassword: String, newPassword: String): Result<Unit> {
        val result = safeApiCall {
            authApi.changePassword(ChangePasswordRequest(oldPassword, newPassword))
        }
        return when (result) {
            is Result.Success -> Result.Success(Unit)
            is Result.Error -> result
            is Result.Loading -> result
        }
    }

    private fun com.bytebox.core.network.dto.UserDto.toDomain() = User(
        id = id,
        email = email,
        displayName = displayName,
        avatarKey = avatarKey,
        avatarUrl = avatarUrl,
        storageUsed = storageUsed,
        storageLimit = storageLimit,
        plan = plan,
        isActive = isActive,
        isAdmin = isAdmin,
        emailVerified = emailVerified,
        twoFactorEnabled = twoFactorEnabled,
        lastLoginAt = lastLoginAt,
        createdAt = createdAt
    )
}
