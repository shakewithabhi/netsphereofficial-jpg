package com.bytebox.core.network.api

import com.bytebox.core.network.dto.*
import retrofit2.Response
import retrofit2.http.*

interface UploadApi {

    @POST("uploads/init")
    suspend fun initUpload(@Body request: InitUploadRequest): Response<InitUploadResponse>

    @POST("uploads/{id}/complete-part")
    suspend fun completePart(
        @Path("id") uploadId: String,
        @Body request: CompletePartRequest
    ): Response<Unit>

    @POST("uploads/{id}/finalize")
    suspend fun finalizeUpload(@Path("id") uploadId: String): Response<FileDto>

    @GET("uploads/{id}/status")
    suspend fun getUploadStatus(@Path("id") uploadId: String): Response<UploadStatusResponse>
}
