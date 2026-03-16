package com.bytebox.domain.model

data class Folder(
    val id: String,
    val name: String,
    val parentId: String?,
    val path: String,
    val trashedAt: String?,
    val createdAt: String,
    val updatedAt: String
)
