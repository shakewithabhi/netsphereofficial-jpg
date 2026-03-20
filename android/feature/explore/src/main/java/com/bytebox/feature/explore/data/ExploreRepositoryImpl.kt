package com.bytebox.feature.explore.data

import com.bytebox.core.common.Result
import com.bytebox.core.common.map
import com.bytebox.core.network.api.ExploreApi
import com.bytebox.core.network.dto.*
import com.bytebox.core.network.safeApiCall
import com.bytebox.domain.model.CreatorProfile
import com.bytebox.domain.model.Post
import com.bytebox.domain.model.PostComment
import com.bytebox.domain.repository.ExploreRepository
import javax.inject.Inject

class ExploreRepositoryImpl @Inject constructor(
    private val exploreApi: ExploreApi,
) : ExploreRepository {

    override suspend fun getFeed(sort: String, category: String?, limit: Int): Result<List<Post>> {
        return safeApiCall { exploreApi.getFeed(sort, category, limit) }
            .map { it.posts.map { dto -> dto.toDomain() } }
    }

    override suspend fun getTrendingFeed(limit: Int): Result<List<Post>> {
        return safeApiCall { exploreApi.getTrendingFeed(limit) }
            .map { it.posts.map { dto -> dto.toDomain() } }
    }

    override suspend fun getForYouFeed(limit: Int): Result<List<Post>> {
        return safeApiCall { exploreApi.getForYouFeed(limit) }
            .map { it.posts.map { dto -> dto.toDomain() } }
    }

    override suspend fun getSubscriptionFeed(limit: Int): Result<List<Post>> {
        return safeApiCall { exploreApi.getSubscriptionFeed(limit) }
            .map { it.posts.map { dto -> dto.toDomain() } }
    }

    override suspend fun searchPosts(query: String, limit: Int): Result<List<Post>> {
        return safeApiCall { exploreApi.searchPosts(query, limit) }
            .map { it.posts.map { dto -> dto.toDomain() } }
    }

    override suspend fun createPost(
        fileId: String,
        caption: String,
        category: String,
        tags: List<String>,
    ): Result<Post> {
        return safeApiCall {
            exploreApi.createPost(CreatePostRequest(fileId, caption, category, tags))
        }.map { it.toDomain() }
    }

    override suspend fun getPost(id: String): Result<Post> {
        return safeApiCall { exploreApi.getPost(id) }.map { it.toDomain() }
    }

    override suspend fun deletePost(id: String): Result<Unit> {
        return safeApiCall { exploreApi.deletePost(id) }
    }

    override suspend fun likePost(id: String): Result<Unit> {
        return safeApiCall { exploreApi.likePost(id) }
    }

    override suspend fun unlikePost(id: String): Result<Unit> {
        return safeApiCall { exploreApi.unlikePost(id) }
    }

    override suspend fun recordView(id: String, durationSeconds: Int): Result<Unit> {
        return safeApiCall { exploreApi.recordView(id, RecordViewRequest(durationSeconds)) }
    }

    override suspend fun getRelatedPosts(id: String, limit: Int): Result<List<Post>> {
        return safeApiCall { exploreApi.getRelatedPosts(id, limit) }
            .map { it.posts.map { dto -> dto.toDomain() } }
    }

    override suspend fun getPostComments(id: String, limit: Int): Result<List<PostComment>> {
        return safeApiCall { exploreApi.getPostComments(id, limit) }
            .map { it.comments.map { dto -> dto.toDomain() } }
    }

    override suspend fun addComment(postId: String, content: String): Result<PostComment> {
        return safeApiCall { exploreApi.addComment(postId, AddCommentRequest(content)) }
            .map { it.toDomain() }
    }

    override suspend fun deleteComment(postId: String, commentId: String): Result<Unit> {
        return safeApiCall { exploreApi.deleteComment(postId, commentId) }
    }

    override suspend fun subscribe(userId: String): Result<Unit> {
        return safeApiCall { exploreApi.subscribe(userId) }
    }

    override suspend fun unsubscribe(userId: String): Result<Unit> {
        return safeApiCall { exploreApi.unsubscribe(userId) }
    }

    override suspend fun getCreatorProfile(userId: String): Result<CreatorProfile> {
        return safeApiCall { exploreApi.getCreatorProfile(userId) }
            .map { it.toDomain() }
    }

    override suspend fun getWatchHistory(limit: Int): Result<List<Post>> {
        return safeApiCall { exploreApi.getWatchHistory(limit) }
            .map { it.posts.map { dto -> dto.toDomain() } }
    }

    override suspend fun reportPost(id: String, reason: String): Result<Unit> {
        return safeApiCall { exploreApi.reportPost(id, ReportRequest(reason)) }
    }

    override suspend fun getTrendingTags(): Result<List<Pair<String, Long>>> {
        return try {
            safeApiCall { exploreApi.getTrendingTags() }
                .map { it.tags.map { tag -> tag.name to tag.count } }
        } catch (_: Exception) {
            Result.Success(emptyList())
        }
    }

    private fun PostDto.toDomain() = Post(
        id = id,
        userId = userId,
        userName = userName,
        caption = caption,
        category = category,
        tags = tags,
        viewCount = viewCount,
        likeCount = likeCount,
        commentCount = commentCount,
        isLiked = isLiked,
        isSubscribed = isSubscribed,
        subscriberCount = subscriberCount,
        videoUrl = videoUrl,
        thumbnailUrl = thumbnailUrl,
        hlsUrl = hlsUrl,
        fileName = fileName,
        mimeType = mimeType,
        fileSize = fileSize,
        durationSeconds = durationSeconds,
        createdAt = createdAt,
    )

    private fun PostCommentDto.toDomain() = PostComment(
        id = id,
        userId = userId,
        userName = userName,
        content = content,
        createdAt = createdAt,
    )

    private fun CreatorProfileDto.toDomain() = CreatorProfile(
        userId = userId,
        name = name,
        postCount = postCount,
        subscriberCount = subscriberCount,
        isSubscribed = isSubscribed,
    )
}
