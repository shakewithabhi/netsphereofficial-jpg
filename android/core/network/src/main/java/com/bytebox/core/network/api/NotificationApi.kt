package com.bytebox.core.network.api

import com.bytebox.core.network.dto.NotificationCountResponse
import com.bytebox.core.network.dto.NotificationsResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface NotificationApi {

    @GET("notifications")
    suspend fun getNotifications(): Response<NotificationsResponse>

    @GET("notifications/count")
    suspend fun getUnreadCount(): Response<NotificationCountResponse>

    @POST("notifications/{id}/read")
    suspend fun markAsRead(@Path("id") id: String): Response<Unit>

    @POST("notifications/read-all")
    suspend fun markAllAsRead(): Response<Unit>
}
