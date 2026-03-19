package com.bytebox.domain.model

import com.bytebox.core.common.FileCategory
import com.bytebox.core.common.mimeToCategory

data class FileItem(
    val id: String,
    val name: String,
    val folderId: String?,
    val size: Long,
    val mimeType: String,
    val thumbnailUrl: String?,
    val scanStatus: String,
    val trashedAt: String?,
    val createdAt: String,
    val updatedAt: String,
    val isStarred: Boolean = false,
    val shareCode: String? = null,
) {
    val isSharedToExplore: Boolean get() = shareCode != null
    val category: FileCategory get() = mimeType.mimeToCategory()
    val extension: String get() = name.substringAfterLast('.', "")
}
