package com.bytebox.core.network.api

import com.bytebox.core.network.dto.AvatarResponse
import com.bytebox.core.network.dto.UserDto
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.PUT
import retrofit2.http.Part

interface UserApi {

    @GET("auth/me")
    suspend fun getProfile(): Response<UserDto>

    @Multipart
    @PUT("auth/me/avatar")
    suspend fun uploadAvatar(
        @Part avatar: MultipartBody.Part
    ): Response<AvatarResponse>

    @DELETE("auth/me/avatar")
    suspend fun deleteAvatar(): Response<Unit>
}
