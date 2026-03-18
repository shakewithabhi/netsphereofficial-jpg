package com.bytebox.domain.repository

import com.bytebox.core.common.Result
import com.bytebox.domain.model.CreatorProfile
import com.bytebox.domain.model.Post
import com.bytebox.domain.model.PostComment

interface ExploreRepository {
    suspend fun getFeed(
        sort: String = "recent",
        category: String? = null,
        limit: Int = 20,
    ): Result<List<Post>>

    suspend fun getTrendingFeed(limit: Int = 10): Result<List<Post>>
    suspend fun getForYouFeed(limit: Int = 20): Result<List<Post>>
    suspend fun getSubscriptionFeed(limit: Int = 20): Result<List<Post>>
    suspend fun searchPosts(query: String, limit: Int = 20): Result<List<Post>>

    suspend fun createPost(
        fileId: String,
        caption: String,
        category: String,
        tags: List<String>,
    ): Result<Post>

    suspend fun getPost(id: String): Result<Post>
    suspend fun deletePost(id: String): Result<Unit>
    suspend fun likePost(id: String): Result<Unit>
    suspend fun unlikePost(id: String): Result<Unit>
    suspend fun recordView(id: String, durationSeconds: Int): Result<Unit>
    suspend fun getRelatedPosts(id: String, limit: Int = 10): Result<List<Post>>
    suspend fun getPostComments(id: String, limit: Int = 50): Result<List<PostComment>>
    suspend fun addComment(postId: String, content: String): Result<PostComment>
    suspend fun deleteComment(postId: String, commentId: String): Result<Unit>
    suspend fun subscribe(userId: String): Result<Unit>
    suspend fun unsubscribe(userId: String): Result<Unit>
    suspend fun getCreatorProfile(userId: String): Result<CreatorProfile>
    suspend fun getWatchHistory(limit: Int = 20): Result<List<Post>>
    suspend fun reportPost(id: String, reason: String): Result<Unit>
    suspend fun getTrendingTags(): Result<List<Pair<String, Long>>>
}
