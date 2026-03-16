package com.bytebox.core.network.api

import com.bytebox.core.network.dto.*
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.*

interface FileApi {

    @GET("folders/{folderId}/contents")
    suspend fun getFolderContents(
        @Path("folderId") folderId: String?,
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int = 50,
        @Query("sort") sort: String = "name",
        @Query("order") order: String = "asc"
    ): Response<FolderContentsResponse>

    @GET("folders/root/contents")
    suspend fun getRootContents(
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int = 50,
        @Query("sort") sort: String = "name",
        @Query("order") order: String = "asc"
    ): Response<FolderContentsResponse>

    @POST("folders")
    suspend fun createFolder(@Body request: CreateFolderRequest): Response<FolderDto>

    @PUT("folders/{id}")
    suspend fun renameFolder(
        @Path("id") id: String,
        @Body request: RenameFolderRequest
    ): Response<FolderDto>

    @DELETE("folders/{id}")
    suspend fun deleteFolder(@Path("id") id: String): Response<Unit>

    @Multipart
    @POST("files/upload")
    suspend fun uploadFile(
        @Part file: MultipartBody.Part,
        @Part("folder_id") folderId: RequestBody?
    ): Response<FileDto>

    @GET("files/{id}/download")
    suspend fun getDownloadUrl(@Path("id") id: String): Response<DownloadUrlResponse>

    @POST("files/{id}/trash")
    suspend fun trashFile(@Path("id") id: String): Response<Unit>

    @POST("files/{id}/restore")
    suspend fun restoreFile(@Path("id") id: String): Response<Unit>

    @DELETE("files/{id}")
    suspend fun permanentDeleteFile(@Path("id") id: String): Response<Unit>

    @POST("folders/{id}/trash")
    suspend fun trashFolder(@Path("id") id: String): Response<Unit>

    @POST("folders/{id}/restore")
    suspend fun restoreFolder(@Path("id") id: String): Response<Unit>

    @POST("files/{id}/copy")
    suspend fun copyFile(
        @Path("id") id: String,
        @Body request: CopyFileRequest
    ): Response<FileDto>

    @GET("files/trash")
    suspend fun getTrashContents(
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int = 50
    ): Response<FolderContentsResponse>

    @GET("files/search")
    suspend fun searchFiles(
        @Query("q") query: String,
        @Query("cursor") cursor: String? = null,
        @Query("limit") limit: Int = 50
    ): Response<FolderContentsResponse>
}
