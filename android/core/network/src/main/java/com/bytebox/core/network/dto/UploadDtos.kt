package com.bytebox.core.network.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class InitUploadRequest(
    val filename: String,
    @Json(name = "file_size") val fileSize: Long,
    @Json(name = "mime_type") val mimeType: String,
    @Json(name = "folder_id") val folderId: String? = null,
    @Json(name = "chunk_size") val chunkSize: Int
)

@JsonClass(generateAdapter = true)
data class InitUploadResponse(
    @Json(name = "upload_id") val uploadId: String,
    @Json(name = "chunk_size") val chunkSize: Int,
    @Json(name = "total_chunks") val totalChunks: Int,
    @Json(name = "presigned_urls") val presignedUrls: List<String>
)

@JsonClass(generateAdapter = true)
data class CompletePartRequest(
    @Json(name = "part_number") val partNumber: Int,
    val etag: String,
    val size: Long
)

@JsonClass(generateAdapter = true)
data class UploadStatusResponse(
    @Json(name = "upload_id") val uploadId: String,
    val status: String,
    @Json(name = "completed_chunks") val completedChunks: Int,
    @Json(name = "total_chunks") val totalChunks: Int,
    @Json(name = "completed_parts") val completedParts: List<Int>
)
