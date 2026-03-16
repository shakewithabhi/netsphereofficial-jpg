package com.bytebox.core.network

import com.bytebox.core.common.AppException
import com.bytebox.core.common.Result
import com.bytebox.core.network.dto.ApiError
import com.squareup.moshi.Moshi
import retrofit2.Response
import timber.log.Timber

suspend fun <T> safeApiCall(apiCall: suspend () -> Response<T>): Result<T> {
    return try {
        val response = apiCall()
        if (response.isSuccessful) {
            val body = response.body()
            if (body != null) {
                Result.Success(body)
            } else {
                Result.Success(Unit as T)
            }
        } else {
            val errorBody = response.errorBody()?.string()
            val errorMessage = try {
                val moshi = Moshi.Builder().build()
                val adapter = moshi.adapter(ApiError::class.java)
                adapter.fromJson(errorBody ?: "")?.error ?: "Unknown error"
            } catch (e: Exception) {
                errorBody ?: "Unknown error"
            }

            when (response.code()) {
                401 -> Result.Error(AppException.Unauthorized())
                404 -> Result.Error(AppException.NotFound(errorMessage))
                413 -> Result.Error(AppException.StorageFull(errorMessage))
                422 -> Result.Error(AppException.ValidationError(errorMessage))
                else -> Result.Error(AppException.ServerError(response.code(), errorMessage))
            }
        }
    } catch (e: java.net.UnknownHostException) {
        Timber.e(e, "Network error")
        Result.Error(AppException.NetworkError("No internet connection", e))
    } catch (e: java.net.SocketTimeoutException) {
        Timber.e(e, "Timeout")
        Result.Error(AppException.NetworkError("Connection timed out", e))
    } catch (e: Exception) {
        Timber.e(e, "API call failed")
        Result.Error(AppException.Unknown(e.message ?: "Unknown error", e))
    }
}
