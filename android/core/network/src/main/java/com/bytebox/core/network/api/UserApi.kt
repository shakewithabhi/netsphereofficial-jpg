package com.bytebox.core.network.api

import com.bytebox.core.network.dto.UserDto
import retrofit2.Response
import retrofit2.http.GET

interface UserApi {

    @GET("auth/me")
    suspend fun getProfile(): Response<UserDto>
}
