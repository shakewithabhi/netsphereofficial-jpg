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
}
