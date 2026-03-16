package com.bytebox.core.network.interceptor

import com.bytebox.core.datastore.TokenManager
import com.bytebox.core.network.api.AuthApi
import com.bytebox.core.network.dto.RefreshRequest
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Provider

class TokenRefreshInterceptor @Inject constructor(
    private val tokenManager: TokenManager,
    private val authApiProvider: Provider<AuthApi>
) : Interceptor {

    private val lock = Any()

    override fun intercept(chain: Interceptor.Chain): Response {
        val response = chain.proceed(chain.request())

        if (response.code != 401) return response

        synchronized(lock) {
            val refreshToken = runBlocking { tokenManager.getRefreshToken() } ?: return response

            response.close()

            val refreshResponse = runBlocking {
                try {
                    val result = authApiProvider.get().refresh(RefreshRequest(refreshToken))
                    if (result.isSuccessful) result.body() else null
                } catch (e: Exception) {
                    Timber.e(e, "Token refresh failed")
                    null
                }
            }

            if (refreshResponse != null) {
                runBlocking {
                    tokenManager.saveTokens(
                        refreshResponse.accessToken,
                        refreshResponse.refreshToken
                    )
                }

                val newRequest = chain.request().newBuilder()
                    .removeHeader("Authorization")
                    .addHeader("Authorization", "Bearer ${refreshResponse.accessToken}")
                    .build()
                return chain.proceed(newRequest)
            } else {
                runBlocking { tokenManager.clearTokens() }
                return response
            }
        }
    }
}
