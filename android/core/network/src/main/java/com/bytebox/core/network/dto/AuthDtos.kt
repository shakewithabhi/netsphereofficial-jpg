package com.bytebox.core.network.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class RegisterRequest(
    val email: String,
    val password: String,
    @Json(name = "display_name") val displayName: String
)

@JsonClass(generateAdapter = true)
data class LoginRequest(
    val email: String,
    val password: String,
    @Json(name = "device_name") val deviceName: String? = null
)

@JsonClass(generateAdapter = true)
data class RefreshRequest(
    @Json(name = "refresh_token") val refreshToken: String
)

@JsonClass(generateAdapter = true)
data class AuthResponse(
    @Json(name = "access_token") val accessToken: String,
    @Json(name = "refresh_token") val refreshToken: String,
    val user: UserDto
)

@JsonClass(generateAdapter = true)
data class UserDto(
    val id: String,
    val email: String,
    @Json(name = "display_name") val displayName: String?,
    @Json(name = "avatar_url") val avatarUrl: String?,
    @Json(name = "storage_used") val storageUsed: Long,
    @Json(name = "storage_limit") val storageLimit: Long,
    val plan: String,
    @Json(name = "email_verified") val emailVerified: Boolean,
    @Json(name = "created_at") val createdAt: String
)
