package com.bytebox.domain.model

data class FileVersion(
    val id: String,
    val fileId: String,
    val versionNumber: Int,
    val size: Long,
    val contentHash: String,
    val createdAt: String
)
