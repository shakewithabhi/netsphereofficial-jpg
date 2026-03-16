package com.bytebox.domain.model

data class User(
    val id: String,
    val email: String,
    val displayName: String?,
    val avatarUrl: String?,
    val storageUsed: Long,
    val storageLimit: Long,
    val plan: String,
    val emailVerified: Boolean,
    val createdAt: String
)
