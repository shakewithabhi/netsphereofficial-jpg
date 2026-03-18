package com.bytebox.core.network.api

import com.bytebox.core.network.dto.*
import retrofit2.Response
import retrofit2.http.*

interface ExploreApi {

    @GET("explore/feed")
    suspend fun getFeed(
        @Query("sort") sort: String = "recent",
        @Query("category") category: String? = null,
        @Query("limit") limit: Int = 20,
    ): Response<PostFeedResponse>

    @GET("explore/feed/trending")
    suspend fun getTrendingFeed(
        @Query("limit") limit: Int = 10,
    ): Response<PostFeedResponse>

    @GET("explore/feed/foryou")
    suspend fun getForYouFeed(
        @Query("limit") limit: Int = 20,
    ): Response<PostFeedResponse>

    @GET("explore/feed/subscriptions")
    suspend fun getSubscriptionFeed(
        @Query("limit") limit: Int = 20,
    ): Response<PostFeedResponse>

    @GET("explore/search")
    suspend fun searchPosts(
        @Query("q") query: String,
        @Query("limit") limit: Int = 20,
    ): Response<PostFeedResponse>

    @POST("explore/posts")
    suspend fun createPost(@Body request: CreatePostRequest): Response<PostDto>

    @GET("explore/posts/{id}")
    suspend fun getPost(@Path("id") id: String): Response<PostDto>

    @DELETE("explore/posts/{id}")
    suspend fun deletePost(@Path("id") id: String): Response<Unit>

    @POST("explore/posts/{id}/like")
    suspend fun likePost(@Path("id") id: String): Response<Unit>

    @DELETE("explore/posts/{id}/like")
    suspend fun unlikePost(@Path("id") id: String): Response<Unit>

    @POST("explore/posts/{id}/view")
    suspend fun recordView(
        @Path("id") id: String,
        @Body body: RecordViewRequest,
    ): Response<Unit>

    @GET("explore/posts/{id}/related")
    suspend fun getRelatedPosts(
        @Path("id") id: String,
        @Query("limit") limit: Int = 10,
    ): Response<PostFeedResponse>

    @GET("explore/posts/{id}/comments")
    suspend fun getPostComments(
        @Path("id") id: String,
        @Query("limit") limit: Int = 50,
    ): Response<PostCommentsResponse>

    @POST("explore/posts/{id}/comments")
    suspend fun addComment(
        @Path("id") id: String,
        @Body request: AddCommentRequest,
    ): Response<PostCommentDto>

    @DELETE("explore/posts/{id}/comments/{commentId}")
    suspend fun deleteComment(
        @Path("id") id: String,
        @Path("commentId") commentId: String,
    ): Response<Unit>

    @POST("explore/creators/{userId}/subscribe")
    suspend fun subscribe(@Path("userId") userId: String): Response<Unit>

    @DELETE("explore/creators/{userId}/subscribe")
    suspend fun unsubscribe(@Path("userId") userId: String): Response<Unit>

    @GET("explore/creators/{userId}")
    suspend fun getCreatorProfile(
        @Path("userId") userId: String,
    ): Response<CreatorProfileDto>

    @GET("explore/history")
    suspend fun getWatchHistory(
        @Query("limit") limit: Int = 20,
    ): Response<PostFeedResponse>

    @POST("explore/posts/{id}/report")
    suspend fun reportPost(
        @Path("id") id: String,
        @Body request: ReportRequest,
    ): Response<Unit>

    @GET("explore/tags")
    suspend fun getTrendingTags(): Response<TrendingTagsResponse>
}
