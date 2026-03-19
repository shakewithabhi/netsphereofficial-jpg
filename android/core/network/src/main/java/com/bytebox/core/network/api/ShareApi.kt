package com.bytebox.core.network.api

import com.bytebox.core.network.dto.*
import retrofit2.Response
import retrofit2.http.*

interface ShareApi {

    @POST("shares")
    suspend fun createShare(@Body request: CreateShareRequest): Response<ShareDto>

    @GET("shares/{code}")
    suspend fun getShare(@Path("code") code: String): Response<ShareDto>

    @GET("shares/{code}/download")
    suspend fun getShareDownloadUrl(
        @Path("code") code: String,
        @Query("password") password: String? = null
    ): Response<DownloadUrlResponse>

    @DELETE("shares/{id}")
    suspend fun deleteShare(@Path("id") id: String): Response<Unit>

    @GET("shares")
    suspend fun getMyShares(
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int = 50
    ): Response<ShareListResponse>

    @GET("explore")
    suspend fun getExploreItems(
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int = 20,
        @Query("category") category: String? = null,
    ): Response<ExploreResponse>

    // Public share info (with social counts)
    @GET("s/{code}")
    suspend fun getPublicShareInfo(@Path("code") code: String): Response<PublicShareInfoDto>

    // Download URL for a public share
    @POST("s/{code}/download")
    suspend fun downloadPublicShare(@Path("code") code: String): Response<DownloadUrlResponse>

    // Like / unlike a share
    @POST("explore/{code}/like")
    suspend fun toggleLike(@Path("code") code: String): Response<ToggleLikeDto>

    // Comments
    @GET("explore/{code}/comments")
    suspend fun getComments(
        @Path("code") code: String,
        @Query("limit") limit: Int = 50,
        @Query("offset") offset: Int = 0,
    ): Response<ShareCommentsResponseDto>

    @POST("explore/{code}/comments")
    suspend fun addComment(
        @Path("code") code: String,
        @Body request: AddCommentRequest,
    ): Response<ShareCommentDto>
}
