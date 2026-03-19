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
    @Json(name = "like_count") val likeCount: Int = 0,
    @Json(name = "comment_count") val commentCount: Int = 0,
    @Json(name = "hls_url") val hlsUrl: String? = null,
)

@JsonClass(generateAdapter = true)
data class ExploreResponse(
    val items: List<ExploreItemDto> = emptyList(),
    @Json(name = "next_cursor") val nextCursor: String? = null,
)

@JsonClass(generateAdapter = true)
data class PublicShareInfoDto(
    @Json(name = "share_type") val shareType: String = "file",
    @Json(name = "file_name") val fileName: String? = null,
    @Json(name = "file_size") val fileSize: Long? = null,
    @Json(name = "mime_type") val mimeType: String? = null,
    @Json(name = "folder_name") val folderName: String? = null,
    @Json(name = "item_count") val itemCount: Int = 0,
    @Json(name = "has_password") val hasPassword: Boolean = false,
    @Json(name = "is_video") val isVideo: Boolean = false,
    @Json(name = "thumbnail_url") val thumbnailUrl: String? = null,
    @Json(name = "video_thumbnail_url") val videoThumbnailUrl: String? = null,
    @Json(name = "hls_url") val hlsUrl: String? = null,
    @Json(name = "like_count") val likeCount: Int = 0,
    @Json(name = "comment_count") val commentCount: Int = 0,
    @Json(name = "is_liked") val isLiked: Boolean = false,
    @Json(name = "owner_name") val ownerName: String = "",
    @Json(name = "download_count") val downloadCount: Int = 0,
)

@JsonClass(generateAdapter = true)
data class ToggleLikeDto(
    val liked: Boolean = false,
    @Json(name = "like_count") val likeCount: Int = 0,
)

@JsonClass(generateAdapter = true)
data class ShareCommentDto(
    val id: String,
    @Json(name = "share_id") val shareId: String,
    @Json(name = "user_id") val userId: String,
    @Json(name = "user_name") val userName: String = "",
    val content: String,
    @Json(name = "created_at") val createdAt: String,
)

@JsonClass(generateAdapter = true)
data class ShareCommentsResponseDto(
    val comments: List<ShareCommentDto> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class AddCommentRequest(
    val content: String,
)
