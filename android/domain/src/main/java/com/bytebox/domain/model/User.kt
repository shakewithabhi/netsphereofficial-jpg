package com.bytebox.domain.model

data class User(
    val id: String,
    val email: String,
    val displayName: String?,
    val avatarKey: String? = null,
    val avatarUrl: String?,
    val storageUsed: Long,
    val storageLimit: Long,
    val plan: String,
    val isActive: Boolean = true,
    val isAdmin: Boolean = false,
    val emailVerified: Boolean = false,
    val twoFactorEnabled: Boolean = false,
    val lastLoginAt: String? = null,
    val createdAt: String
)
