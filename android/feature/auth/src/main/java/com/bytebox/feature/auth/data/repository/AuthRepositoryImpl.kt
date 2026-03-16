package com.bytebox.feature.auth.data.repository

import com.bytebox.core.common.Result
import com.bytebox.core.database.dao.FileDao
import com.bytebox.core.database.dao.FolderDao
import com.bytebox.core.database.dao.UploadTaskDao
import com.bytebox.core.datastore.TokenManager
import com.bytebox.core.network.api.AuthApi
import com.bytebox.core.network.api.UserApi
import com.bytebox.core.network.dto.LoginRequest
import com.bytebox.core.network.dto.RegisterRequest
import com.bytebox.core.network.safeApiCall
import com.bytebox.domain.model.User
import com.bytebox.domain.repository.AuthRepository
import com.bytebox.core.common.map
import javax.inject.Inject

class AuthRepositoryImpl @Inject constructor(
    private val authApi: AuthApi,
    private val userApi: UserApi,
    private val tokenManager: TokenManager,
    private val fileDao: FileDao,
    private val folderDao: FolderDao,
    private val uploadTaskDao: UploadTaskDao
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
                tokenManager.saveTokens(result.data.accessToken, result.data.refreshToken)
                Result.Success(result.data.user.toDomain())
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
                tokenManager.saveTokens(result.data.accessToken, result.data.refreshToken)
                Result.Success(result.data.user.toDomain())
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

    private fun com.bytebox.core.network.dto.UserDto.toDomain() = User(
        id = id,
        email = email,
        displayName = displayName,
        avatarUrl = avatarUrl,
        storageUsed = storageUsed,
        storageLimit = storageLimit,
        plan = plan,
        emailVerified = emailVerified,
        createdAt = createdAt
    )
}
