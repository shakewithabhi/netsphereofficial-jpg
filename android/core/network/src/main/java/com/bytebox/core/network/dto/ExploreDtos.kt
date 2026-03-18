package com.bytebox.core.network.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class PostDto(
    val id: String,
    @Json(name = "user_id") val userId: String = "",
    @Json(name = "user_name") val userName: String = "",
    val caption: String = "",
    val category: String = "",
    val tags: List<String> = emptyList(),
    @Json(name = "view_count") val viewCount: Long = 0,
    @Json(name = "like_count") val likeCount: Long = 0,
    @Json(name = "comment_count") val commentCount: Long = 0,
    @Json(name = "is_liked") val isLiked: Boolean = false,
    @Json(name = "is_subscribed") val isSubscribed: Boolean = false,
    @Json(name = "subscriber_count") val subscriberCount: Long = 0,
    @Json(name = "video_url") val videoUrl: String? = null,
    @Json(name = "thumbnail_url") val thumbnailUrl: String? = null,
    @Json(name = "hls_url") val hlsUrl: String? = null,
    @Json(name = "file_name") val fileName: String = "",
    @Json(name = "mime_type") val mimeType: String = "",
    @Json(name = "file_size") val fileSize: Long = 0,
    @Json(name = "duration_seconds") val durationSeconds: Int = 0,
    @Json(name = "created_at") val createdAt: String = "",
)

@JsonClass(generateAdapter = true)
data class PostCommentDto(
    val id: String,
    @Json(name = "user_id") val userId: String = "",
    @Json(name = "user_name") val userName: String = "",
    val content: String = "",
    @Json(name = "created_at") val createdAt: String = "",
)

@JsonClass(generateAdapter = true)
data class CreatorProfileDto(
    @Json(name = "user_id") val userId: String,
    val name: String = "",
    @Json(name = "post_count") val postCount: Long = 0,
    @Json(name = "subscriber_count") val subscriberCount: Long = 0,
    @Json(name = "is_subscribed") val isSubscribed: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class PostFeedResponse(
    val posts: List<PostDto> = emptyList(),
    @Json(name = "next_cursor") val nextCursor: String? = null,
)

@JsonClass(generateAdapter = true)
data class PostCommentsResponse(
    val comments: List<PostCommentDto> = emptyList(),
    @Json(name = "total") val total: Int = 0,
)

@JsonClass(generateAdapter = true)
data class CreatePostRequest(
    @Json(name = "file_id") val fileId: String,
    val caption: String = "",
    val category: String = "",
    val tags: List<String> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class AddCommentRequest(
    val content: String,
)

@JsonClass(generateAdapter = true)
data class RecordViewRequest(
    @Json(name = "duration_seconds") val durationSeconds: Int = 0,
)

@JsonClass(generateAdapter = true)
data class ReportRequest(
    val reason: String,
)

@JsonClass(generateAdapter = true)
data class TrendingTagsResponse(
    val tags: List<TrendingTag> = emptyList(),
)

@JsonClass(generateAdapter = true)
data class TrendingTag(
    val name: String,
    val count: Long = 0,
)
