package com.bytebox.core.network.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class FileDto(
    val id: String,
    val name: String,
    @Json(name = "folder_id") val folderId: String?,
    val size: Long,
    @Json(name = "mime_type") val mimeType: String,
    @Json(name = "thumbnail_url") val thumbnailUrl: String?,
    @Json(name = "scan_status") val scanStatus: String,
    @Json(name = "trashed_at") val trashedAt: String?,
    @Json(name = "created_at") val createdAt: String,
    @Json(name = "updated_at") val updatedAt: String
)

@JsonClass(generateAdapter = true)
data class FolderDto(
    val id: String,
    val name: String,
    @Json(name = "parent_id") val parentId: String? = null,
    val path: String = "",
    @Json(name = "trashed_at") val trashedAt: String? = null,
    @Json(name = "created_at") val createdAt: String = "",
    @Json(name = "updated_at") val updatedAt: String = ""
)

@JsonClass(generateAdapter = true)
data class FolderContentsResponse(
    val files: List<FileDto> = emptyList(),
    val folders: List<FolderDto> = emptyList(),
    @Json(name = "next_cursor") val nextCursor: String? = null,
    @Json(name = "total_count") val totalCount: Int = 0
)

@JsonClass(generateAdapter = true)
data class CreateFolderRequest(
    val name: String,
    @Json(name = "parent_id") val parentId: String? = null
)

@JsonClass(generateAdapter = true)
data class RenameFolderRequest(
    val name: String
)

@JsonClass(generateAdapter = true)
data class CopyFileRequest(
    @Json(name = "folder_id") val folderId: String? = null
)

@JsonClass(generateAdapter = true)
data class DownloadUrlResponse(
    val url: String,
    @Json(name = "expires_in") val expiresIn: Long = 3600,
    @Json(name = "is_video") val isVideo: Boolean = false,
    @Json(name = "hls_url") val hlsUrl: String? = null,
    @Json(name = "video_thumbnail_url") val videoThumbnailUrl: String? = null
)

@JsonClass(generateAdapter = true)
data class FileVersionDto(
    val id: String,
    @Json(name = "file_id") val fileId: String,
    @Json(name = "version_number") val versionNumber: Int,
    val size: Long,
    @Json(name = "content_hash") val contentHash: String,
    @Json(name = "created_at") val createdAt: String
)

@JsonClass(generateAdapter = true)
data class FileVersionsResponse(
    val versions: List<FileVersionDto>
)
