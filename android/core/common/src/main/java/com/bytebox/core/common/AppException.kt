package com.bytebox.core.common

sealed class AppException(
    override val message: String,
    override val cause: Throwable? = null
) : Exception(message, cause) {

    class NetworkError(message: String = "Network error", cause: Throwable? = null) :
        AppException(message, cause)

    class ServerError(val code: Int, message: String) :
        AppException(message)

    class Unauthorized(message: String = "Session expired. Please log in again.") :
        AppException(message)

    class NotFound(message: String = "Resource not found") :
        AppException(message)

    class StorageFull(message: String = "Storage quota exceeded") :
        AppException(message)

    class ValidationError(message: String) :
        AppException(message)

    class Unknown(message: String = "An unexpected error occurred", cause: Throwable? = null) :
        AppException(message, cause)
}
