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
data class GoogleLoginRequest(
    @Json(name = "id_token") val idToken: String
)

@JsonClass(generateAdapter = true)
data class RefreshRequest(
    @Json(name = "refresh_token") val refreshToken: String
)

@JsonClass(generateAdapter = true)
data class AuthResponse(
    @Json(name = "access_token") val accessToken: String? = null,
    @Json(name = "refresh_token") val refreshToken: String? = null,
    val user: UserDto? = null,
    @Json(name = "requires_two_factor") val requiresTwoFactor: Boolean? = null,
    @Json(name = "temp_token") val tempToken: String? = null
)

@JsonClass(generateAdapter = true)
data class TwoFactorLoginRequest(
    @Json(name = "temp_token") val tempToken: String,
    val code: String
)

@JsonClass(generateAdapter = true)
data class ChangePasswordRequest(
    @Json(name = "old_password") val oldPassword: String,
    @Json(name = "new_password") val newPassword: String
)

@JsonClass(generateAdapter = true)
data class ForgotPasswordRequest(
    val email: String
)

@JsonClass(generateAdapter = true)
data class ForgotPasswordResponse(
    val message: String,
    val token: String?
)

@JsonClass(generateAdapter = true)
data class ResetPasswordRequest(
    val token: String,
    @Json(name = "new_password") val newPassword: String
)

@JsonClass(generateAdapter = true)
data class MessageResponse(
    val message: String
)

@JsonClass(generateAdapter = true)
data class UserDto(
    val id: String,
    val email: String,
    @Json(name = "display_name") val displayName: String?,
    @Json(name = "avatar_key") val avatarKey: String? = null,
    @Json(name = "avatar_url") val avatarUrl: String?,
    @Json(name = "storage_used") val storageUsed: Long,
    @Json(name = "storage_limit") val storageLimit: Long,
    val plan: String,
    @Json(name = "is_active") val isActive: Boolean = true,
    @Json(name = "is_admin") val isAdmin: Boolean = false,
    @Json(name = "email_verified") val emailVerified: Boolean = false,
    @Json(name = "two_factor_enabled") val twoFactorEnabled: Boolean = false,
    @Json(name = "last_login_at") val lastLoginAt: String? = null,
    @Json(name = "created_at") val createdAt: String
)

@JsonClass(generateAdapter = true)
data class AvatarResponse(
    @Json(name = "avatar_key") val avatarKey: String,
    @Json(name = "avatar_url") val avatarUrl: String
)
