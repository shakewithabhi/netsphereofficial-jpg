package com.bytebox.core.network.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class CreateShareRequest(
    @Json(name = "file_id") val fileId: String? = null,
    @Json(name = "folder_id") val folderId: String? = null,
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

@JsonClass(generateAdapter = true)
data class ShareInfoResponse(
    @Json(name = "file_name") val fileName: String,
    @Json(name = "file_size") val fileSize: Long,
    @Json(name = "mime_type") val mimeType: String,
    @Json(name = "is_video") val isVideo: Boolean = false,
    @Json(name = "is_image") val isImage: Boolean = false,
    @Json(name = "is_folder") val isFolder: Boolean = false,
    @Json(name = "has_password") val hasPassword: Boolean = false,
    @Json(name = "preview_available") val previewAvailable: Boolean = false,
    @Json(name = "video_thumbnail_url") val videoThumbnailUrl: String? = null,
    @Json(name = "download_count") val downloadCount: Long? = 0L,
    @Json(name = "video_duration_seconds") val videoDurationSeconds: Int? = null,
    @Json(name = "app_download_url") val appDownloadUrl: String? = null,
    @Json(name = "expires_at") val expiresAt: String? = null
)

@JsonClass(generateAdapter = true)
data class SharePreviewResponse(
    val url: String,
    @Json(name = "preview_duration_seconds") val previewDurationSeconds: Int = 0,
    @Json(name = "file_name") val fileName: String,
    @Json(name = "file_size") val fileSize: Long,
    @Json(name = "mime_type") val mimeType: String,
    @Json(name = "is_video") val isVideo: Boolean = false,
    @Json(name = "is_image") val isImage: Boolean = false,
    @Json(name = "requires_login") val requiresLogin: Boolean = true,
    @Json(name = "video_duration_seconds") val videoDurationSeconds: Int? = null
)

@JsonClass(generateAdapter = true)
data class SaveToStorageRequest(
    @Json(name = "folder_id") val folderId: String? = null
)

@JsonClass(generateAdapter = true)
data class ExploreItemDto(
    val id: String,
    val code: String,
    @Json(name = "file_name") val fileName: String,
    @Json(name = "file_size") val fileSize: Long = 0,
    @Json(name = "mime_type") val mimeType: String,
    @Json(name = "thumbnail_url") val thumbnailUrl: String? = null,
    @Json(name = "owner_name") val ownerName: String = "",
    @Json(name = "download_count") val downloadCount: Int = 0,
    @Json(name = "created_at") val createdAt: String,
)

@JsonClass(generateAdapter = true)
data class ExploreResponse(
    val items: List<ExploreItemDto> = emptyList(),
    @Json(name = "next_cursor") val nextCursor: String? = null,
)
