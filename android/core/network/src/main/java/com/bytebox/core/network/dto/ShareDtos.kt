package com.bytebox.core.network.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class CreateShareRequest(
    @Json(name = "file_id") val fileId: String,
    val password: String? = null,
    @Json(name = "expires_at") val expiresAt: String? = null,
    @Json(name = "max_downloads") val maxDownloads: Int? = null
)

@JsonClass(generateAdapter = true)
data class ShareDto(
    val id: String,
    @Json(name = "file_id") val fileId: String = "",
    val code: String,
    @Json(name = "url") val shareUrl: String,
    @Json(name = "has_password") val hasPassword: Boolean = false,
    @Json(name = "expires_at") val expiresAt: String? = null,
    @Json(name = "max_downloads") val maxDownloads: Int? = null,
    @Json(name = "download_count") val downloadCount: Int = 0,
    @Json(name = "is_active") val isActive: Boolean = true,
    @Json(name = "file_name") val fileName: String? = null,
    @Json(name = "file_size") val fileSize: Long? = null,
    @Json(name = "mime_type") val mimeType: String? = null,
    @Json(name = "created_at") val createdAt: String = ""
)

@JsonClass(generateAdapter = true)
data class ShareListResponse(
    val shares: List<ShareDto>,
    @Json(name = "next_cursor") val nextCursor: String?
)

@JsonClass(generateAdapter = true)
data class ApiError(
    val error: String,
    val message: String
)
